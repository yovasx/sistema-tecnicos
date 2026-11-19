-- El email deja de ser un requisito del expediente. Se conserva su historial.
ALTER TABLE identity.perfiles_tecnico DROP CONSTRAINT ck_tecnico_expediente_completo;
ALTER TABLE identity.perfiles_tecnico ADD CONSTRAINT ck_tecnico_expediente_completo CHECK (
    NOT expediente_requerido OR nivel < 2 OR (
        ci IS NOT NULL AND fecha_nacimiento IS NOT NULL AND ci_frente_url IS NOT NULL
        AND ci_dorso_url IS NOT NULL AND COALESCE(cardinality(certificaciones_url),0)>0
    )
);
CREATE OR REPLACE FUNCTION identity.expediente_editable(p_id BIGINT) RETURNS VOID AS $$
DECLARE v RECORD;
BEGIN
    SELECT p.*,u.activo,u.eliminado_en INTO v FROM identity.perfiles_tecnico p
    JOIN identity.usuarios u ON u.id=p.usuario_id WHERE p.usuario_id=p_id FOR UPDATE OF p;
    IF NOT FOUND OR NOT v.activo OR v.eliminado_en IS NOT NULL THEN
        RAISE EXCEPTION 'El perfil técnico no está disponible.';
    END IF;
    IF v.estado_expediente NOT IN ('borrador','observado') THEN
        RAISE EXCEPTION 'No podés modificar un expediente enviado, aprobado o rechazado.';
    END IF;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION identity.expediente_aprobar(p_admin BIGINT,p_id BIGINT) RETURNS VOID AS $$
BEGIN
    PERFORM identity.validar_revisor(p_admin);
    UPDATE identity.perfiles_tecnico SET estado_expediente='aprobado',estado_validacion='aprobado',
        nivel=3,validado_por=p_admin,fecha_validacion=clock_timestamp()
    WHERE usuario_id=p_id AND estado_expediente='en_revision' AND nivel=2 AND observaciones='{}'::jsonb;
    IF NOT FOUND THEN RAISE EXCEPTION 'El expediente no está listo para aprobar.'; END IF;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE identity.usuarios ADD COLUMN version_sesion BIGINT NOT NULL DEFAULT 0;
-- Las identidades exclusivamente Google no tienen contraseña local.
ALTER TABLE identity.usuarios ALTER COLUMN password_hash DROP NOT NULL;
CREATE TABLE identity.identidades_google (
    sujeto TEXT PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES identity.usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE identity.limites_recuperacion (
    email_hash TEXT PRIMARY KEY,
    ventana TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ultimo TIMESTAMPTZ,
    envios INT NOT NULL DEFAULT 0
);
CREATE TABLE identity.recuperaciones (
    id UUID PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    codigo_hash TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expira_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()+INTERVAL '10 minutes',
    intentos INT NOT NULL DEFAULT 0 CHECK(intentos BETWEEN 0 AND 5),
    confirmado_en TIMESTAMPTZ,
    permiso_hash TEXT,
    permiso_expira_en TIMESTAMPTZ,
    consumido BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_recuperacion_usuario ON identity.recuperaciones(usuario_id);

-- Serializa incluso emails inexistentes; respuestas externas siempre iguales.
CREATE FUNCTION identity.solicitar_recuperacion(p_email TEXT,p_id UUID,p_codigo TEXT) RETURNS BOOLEAN AS $$
DECLARE v identity.limites_recuperacion%ROWTYPE; v_hash TEXT; v_usuario BIGINT;
BEGIN
    v_hash:=encode(digest(lower(btrim(p_email)),'sha256'),'hex');
    INSERT INTO identity.limites_recuperacion(email_hash) VALUES(v_hash) ON CONFLICT DO NOTHING;
    SELECT * INTO v FROM identity.limites_recuperacion WHERE email_hash=v_hash FOR UPDATE;
    IF v.ventana < clock_timestamp()-INTERVAL '1 hour' THEN
        v.envios:=0;
        UPDATE identity.limites_recuperacion SET ventana=clock_timestamp(),envios=0 WHERE email_hash=v_hash;
    END IF;
    IF v.ultimo > clock_timestamp()-INTERVAL '60 seconds' OR v.envios>=5 THEN RETURN FALSE; END IF;
    UPDATE identity.limites_recuperacion SET envios=envios+1,ultimo=clock_timestamp() WHERE email_hash=v_hash;
    SELECT id INTO v_usuario FROM identity.usuarios WHERE lower(email)=lower(btrim(p_email))
        AND activo AND eliminado_en IS NULL AND password_hash IS NOT NULL FOR UPDATE;
    -- Mismo costo de hash para cuentas ausentes o Google, sin crear una contraseña local.
    p_codigo:=crypt(p_codigo,gen_salt('bf',10));
    IF v_usuario IS NULL THEN RETURN FALSE; END IF;
    UPDATE identity.recuperaciones SET consumido=TRUE WHERE usuario_id=v_usuario AND NOT consumido;
    INSERT INTO identity.recuperaciones(id,usuario_id,codigo_hash) VALUES(p_id,v_usuario,p_codigo);
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
CREATE FUNCTION identity.confirmar_recuperacion(p_id UUID,p_codigo TEXT,p_permiso TEXT) RETURNS BOOLEAN AS $$
DECLARE v identity.recuperaciones%ROWTYPE;
BEGIN
    SELECT * INTO v FROM identity.recuperaciones WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR v.consumido OR v.confirmado_en IS NOT NULL
        OR v.expira_en<=clock_timestamp() OR v.intentos>=5 THEN RETURN FALSE; END IF;
    UPDATE identity.recuperaciones SET intentos=intentos+1 WHERE id=p_id;
    IF crypt(p_codigo,v.codigo_hash) IS DISTINCT FROM v.codigo_hash THEN RETURN FALSE; END IF;
    UPDATE identity.recuperaciones SET confirmado_en=clock_timestamp(),
        permiso_hash=encode(digest(p_permiso,'sha256'),'hex'),
        permiso_expira_en=clock_timestamp()+INTERVAL '10 minutes' WHERE id=p_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
CREATE FUNCTION identity.restablecer_password(p_id UUID,p_permiso TEXT,p_hash TEXT) RETURNS BOOLEAN AS $$
DECLARE v identity.recuperaciones%ROWTYPE; v_usuario BIGINT;
BEGIN
    SELECT usuario_id INTO v_usuario FROM identity.recuperaciones WHERE id=p_id;
    -- Mismo orden de locks que solicitar: usuario antes que desafíos.
    PERFORM 1 FROM identity.usuarios WHERE id=v_usuario AND activo
        AND eliminado_en IS NULL AND password_hash IS NOT NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    SELECT * INTO v FROM identity.recuperaciones WHERE id=p_id FOR UPDATE;
    IF v.consumido OR v.confirmado_en IS NULL OR v.permiso_expira_en<=clock_timestamp()
        OR v.permiso_hash IS DISTINCT FROM encode(digest(p_permiso,'sha256'),'hex') THEN RETURN FALSE; END IF;
    UPDATE identity.usuarios SET password_hash=p_hash,version_sesion=version_sesion+1 WHERE id=v_usuario;
    UPDATE identity.recuperaciones SET consumido=TRUE,permiso_hash=NULL WHERE usuario_id=v_usuario;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

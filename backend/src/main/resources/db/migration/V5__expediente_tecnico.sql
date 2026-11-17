-- V5 aún no aplicada: expediente técnico con revisión documental humana.
-- Nivel 2 significa expediente completo, NO identidad verificada por biometría.
CREATE TYPE identity.estado_expediente AS ENUM
    ('borrador', 'en_revision', 'observado', 'aprobado', 'rechazado');

ALTER TABLE identity.perfiles_tecnico
    ADD COLUMN ci VARCHAR(20),
    ADD COLUMN ci_frente_url TEXT,
    ADD COLUMN ci_dorso_url TEXT,
    ADD COLUMN fecha_nacimiento DATE,
    ADD COLUMN email_verificado_en TIMESTAMPTZ,
    ADD COLUMN nivel SMALLINT NOT NULL DEFAULT 0 CHECK (nivel BETWEEN 0 AND 3),
    ADD COLUMN estado_expediente identity.estado_expediente NOT NULL DEFAULT 'borrador',
    ADD COLUMN observaciones JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN enviado_en TIMESTAMPTZ,
    ADD COLUMN expediente_requerido BOOLEAN NOT NULL DEFAULT TRUE;

-- No inventar verificaciones ni bloquear técnicos aprobados antes de V5.
UPDATE identity.perfiles_tecnico
SET expediente_requerido = FALSE, estado_expediente = 'aprobado', nivel = 3
WHERE estado_validacion = 'aprobado';

-- CI normalizado y único también frente a peticiones simultáneas.
CREATE UNIQUE INDEX uq_tecnico_ci ON identity.perfiles_tecnico(ci) WHERE ci IS NOT NULL;

CREATE TABLE identity.codigos_verificacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    codigo_hash TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expira_en TIMESTAMPTZ NOT NULL,
    intentos INT NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 5),
    confirmado_en TIMESTAMPTZ,
    invalidado BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_codigos_usuario ON identity.codigos_verificacion(usuario_id, id DESC);

CREATE FUNCTION identity.expediente_editable(p_id BIGINT) RETURNS VOID AS $$
DECLARE v RECORD;
BEGIN
    SELECT p.*, u.activo, u.eliminado_en INTO v
    FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id = p.usuario_id
    WHERE p.usuario_id = p_id FOR UPDATE OF p;
    IF NOT FOUND OR NOT v.activo OR v.eliminado_en IS NOT NULL THEN
        RAISE EXCEPTION 'El perfil técnico no está disponible.';
    END IF;
    IF v.estado_expediente NOT IN ('borrador', 'observado') THEN
        RAISE EXCEPTION 'No podés modificar un expediente enviado, aprobado o rechazado.';
    END IF;
    IF v.email_verificado_en IS NULL THEN
        RAISE EXCEPTION 'Verificá tu email antes de completar el expediente.';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.registrar_tecnico(
    p_nombre VARCHAR, p_apellido VARCHAR, p_email VARCHAR,
    p_telefono VARCHAR, p_hash VARCHAR
) RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO identity.usuarios(rol,nombre,apellido,email,telefono,password_hash,activo)
    VALUES ('tecnico', btrim(p_nombre), btrim(p_apellido), lower(btrim(p_email)),
            NULLIF(btrim(p_telefono),''), p_hash, TRUE) RETURNING id INTO v_id;
    INSERT INTO identity.perfiles_tecnico(usuario_id) VALUES(v_id);
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.solicitar_codigo_email(p_id BIGINT) RETURNS TEXT AS $$
DECLARE v_codigo TEXT; v_ultimo TIMESTAMPTZ; v_bytes BYTEA;
BEGIN
    -- Serializa solicitudes/confirmaciones del mismo usuario.
    PERFORM 1 FROM identity.perfiles_tecnico WHERE usuario_id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe el perfil técnico.'; END IF;
    IF EXISTS (SELECT 1 FROM identity.perfiles_tecnico
               WHERE usuario_id=p_id AND email_verificado_en IS NOT NULL) THEN
        RAISE EXCEPTION 'Tu email ya está verificado.';
    END IF;
    SELECT max(creado_en) INTO v_ultimo FROM identity.codigos_verificacion WHERE usuario_id=p_id;
    IF v_ultimo > clock_timestamp() - INTERVAL '60 seconds' THEN
        RAISE EXCEPTION 'Esperá 60 segundos antes de pedir otro código.';
    END IF;
    IF (SELECT count(*) FROM identity.codigos_verificacion
        WHERE usuario_id=p_id AND creado_en > clock_timestamp()-INTERVAL '1 hour') >= 5 THEN
        RAISE EXCEPTION 'Alcanzaste el límite de envíos. Intentá dentro de una hora.';
    END IF;
    v_bytes := gen_random_bytes(4);
    v_codigo := lpad(((get_byte(v_bytes,0)::bigint*16777216
                + get_byte(v_bytes,1)::bigint*65536
                + get_byte(v_bytes,2)::bigint*256 + get_byte(v_bytes,3)) % 1000000)::text,6,'0');
    UPDATE identity.codigos_verificacion SET invalidado=TRUE
    WHERE usuario_id=p_id AND confirmado_en IS NULL;
    INSERT INTO identity.codigos_verificacion(usuario_id,codigo_hash,expira_en)
    VALUES(p_id, crypt(v_codigo,gen_salt('bf',8)), clock_timestamp()+INTERVAL '10 minutes');
    RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;

-- Devuelve estado en lugar de RAISE: así los intentos erróneos SÍ se confirman.
CREATE FUNCTION identity.confirmar_codigo_email(p_id BIGINT,p_codigo TEXT) RETURNS TEXT AS $$
DECLARE v identity.codigos_verificacion%ROWTYPE;
BEGIN
    PERFORM 1 FROM identity.perfiles_tecnico WHERE usuario_id=p_id FOR UPDATE;
    SELECT * INTO v FROM identity.codigos_verificacion WHERE usuario_id=p_id
    ORDER BY id DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND OR v.invalidado OR v.confirmado_en IS NOT NULL THEN RETURN 'SIN_CODIGO'; END IF;
    IF v.expira_en <= clock_timestamp() THEN RETURN 'EXPIRADO'; END IF;
    IF v.intentos >= 5 THEN RETURN 'BLOQUEADO'; END IF;
    IF crypt(p_codigo,v.codigo_hash) IS DISTINCT FROM v.codigo_hash THEN
        UPDATE identity.codigos_verificacion SET intentos=intentos+1 WHERE id=v.id;
        RETURN 'INCORRECTO';
    END IF;
    UPDATE identity.codigos_verificacion SET confirmado_en=clock_timestamp() WHERE id=v.id;
    UPDATE identity.perfiles_tecnico SET email_verificado_en=clock_timestamp(),nivel=GREATEST(nivel,1)
    WHERE usuario_id=p_id;
    RETURN 'CONFIRMADO';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.expediente_datos_personales(p_id BIGINT,p_ci VARCHAR,p_fecha DATE)
RETURNS VOID AS $$
BEGIN
    PERFORM identity.expediente_editable(p_id);
    -- Admite complemento del CI boliviano, por ejemplo 1234567-1A.
    IF p_ci IS NULL OR upper(btrim(p_ci)) !~ '^[0-9]{5,15}(-[0-9A-Z]{1,3})?$' THEN
        RAISE EXCEPTION 'Ingresá un CI válido, incluido su complemento si corresponde.';
    END IF;
    IF p_fecha IS NULL OR p_fecha > CURRENT_DATE - INTERVAL '18 years'
       OR p_fecha < CURRENT_DATE - INTERVAL '100 years' THEN
        RAISE EXCEPTION 'Debés tener entre 18 y 100 años.';
    END IF;
    UPDATE identity.perfiles_tecnico SET ci=upper(btrim(p_ci)),fecha_nacimiento=p_fecha,
        observaciones=observaciones - ARRAY['ci','fechaNacimiento']
    WHERE usuario_id=p_id;
END;
$$ LANGUAGE plpgsql;

-- Reemplazos parciales: NULL conserva el documento anterior.
CREATE FUNCTION identity.expediente_documentos(p_id BIGINT,p_frente TEXT,p_dorso TEXT,p_certs TEXT[])
RETURNS VOID AS $$
BEGIN
    PERFORM identity.expediente_editable(p_id);
    UPDATE identity.perfiles_tecnico SET
        ci_frente_url=COALESCE(p_frente,ci_frente_url),
        ci_dorso_url=COALESCE(p_dorso,ci_dorso_url),
        certificaciones_url=COALESCE(p_certs,certificaciones_url),
        observaciones=observaciones
          - (CASE WHEN p_frente IS NOT NULL THEN ARRAY['ciFrenteUrl'] ELSE ARRAY[]::TEXT[] END)
          - (CASE WHEN p_dorso IS NOT NULL THEN ARRAY['ciDorsoUrl'] ELSE ARRAY[]::TEXT[] END)
          - (CASE WHEN p_certs IS NOT NULL THEN ARRAY['certificacionesUrl'] ELSE ARRAY[]::TEXT[] END)
    WHERE usuario_id=p_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.expediente_especialidades(p_id BIGINT,p_categorias INT[])
RETURNS VOID AS $$
BEGIN
    PERFORM identity.expediente_editable(p_id);
    IF COALESCE(cardinality(p_categorias),0)=0 OR cardinality(p_categorias)>20
       OR EXISTS(SELECT 1 FROM unnest(p_categorias) c WHERE c IS NULL
                 OR NOT EXISTS(SELECT 1 FROM orders.categorias_servicio WHERE id=c AND activa)) THEN
        RAISE EXCEPTION 'Elegí al menos una especialidad activa del catálogo.';
    END IF;
    DELETE FROM identity.tecnico_especialidades WHERE tecnico_id=p_id;
    INSERT INTO identity.tecnico_especialidades SELECT p_id,c FROM unnest(p_categorias)c GROUP BY c;
    UPDATE identity.perfiles_tecnico SET observaciones=observaciones-'especialidades' WHERE usuario_id=p_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.expediente_zona(p_id BIGINT,p_nombre VARCHAR,p_lat FLOAT8,p_lng FLOAT8,p_radio NUMERIC)
RETURNS VOID AS $$
BEGIN
    PERFORM identity.expediente_editable(p_id);
    IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 100
       OR p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90
       OR p_lng NOT BETWEEN -180 AND 180 OR p_radio IS NULL OR p_radio NOT BETWEEN 100 AND 20000 THEN
        RAISE EXCEPTION 'Completá una zona válida y un radio entre 100 y 20000 metros.';
    END IF;
    -- Una zona editable por expediente; no duplicar áreas en cada reintento.
    DELETE FROM geo.zonas_cobertura WHERE tecnico_id=p_id;
    INSERT INTO geo.zonas_cobertura(tecnico_id,nombre_zona,poligono)
    VALUES(p_id,btrim(p_nombre),ST_Buffer(ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography,p_radio::float8));
    UPDATE identity.perfiles_tecnico SET observaciones=observaciones-'zonas' WHERE usuario_id=p_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.expediente_enviar(p_id BIGINT) RETURNS VOID AS $$
DECLARE v identity.perfiles_tecnico%ROWTYPE;
BEGIN
    PERFORM identity.expediente_editable(p_id);
    SELECT * INTO v FROM identity.perfiles_tecnico WHERE usuario_id=p_id;
    IF v.ci IS NULL OR v.fecha_nacimiento IS NULL OR v.ci_frente_url IS NULL
       OR v.ci_dorso_url IS NULL OR COALESCE(cardinality(v.certificaciones_url),0)=0 THEN
        RAISE EXCEPTION 'Completá tus datos, las dos caras del CI y un certificado técnico.';
    END IF;
    IF v.observaciones <> '{}'::jsonb THEN RAISE EXCEPTION 'Corregí todos los campos observados antes de reenviar.'; END IF;
    IF NOT EXISTS(SELECT 1 FROM identity.tecnico_especialidades e
        JOIN orders.categorias_servicio c ON c.id=e.categoria_id AND c.activa WHERE e.tecnico_id=p_id)
       OR NOT EXISTS(SELECT 1 FROM geo.zonas_cobertura WHERE tecnico_id=p_id AND activo) THEN
        RAISE EXCEPTION 'Elegí una especialidad activa y definí tu zona de cobertura.';
    END IF;
    UPDATE identity.perfiles_tecnico SET nivel=2,estado_expediente='en_revision',
        enviado_en=clock_timestamp() WHERE usuario_id=p_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.validar_revisor(p_admin BIGINT) RETURNS VOID AS $$
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_admin OR NOT EXISTS(
        SELECT 1 FROM identity.usuarios WHERE id=p_admin AND rol='administrador' AND activo AND eliminado_en IS NULL
    ) THEN RAISE EXCEPTION 'Solo un administrador activo puede revisar documentos.'; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.expediente_observar(p_admin BIGINT,p_id BIGINT,p_obs JSONB)
RETURNS VOID AS $$
BEGIN
    PERFORM identity.validar_revisor(p_admin);
    IF p_obs IS NULL OR jsonb_typeof(p_obs)<>'object' OR p_obs='{}'::jsonb THEN
        RAISE EXCEPTION 'Indicá al menos un campo y su observación.';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each_text(p_obs) e
        WHERE e.key NOT IN ('ci','fechaNacimiento','ciFrenteUrl','ciDorsoUrl','certificacionesUrl','especialidades','zonas')
           OR length(btrim(e.value)) NOT BETWEEN 3 AND 500 OR e.value IS NULL) THEN
        RAISE EXCEPTION 'Los campos o motivos observados no son válidos.';
    END IF;
    UPDATE identity.perfiles_tecnico SET estado_expediente='observado',observaciones=p_obs
    WHERE usuario_id=p_id AND estado_expediente='en_revision';
    IF NOT FOUND THEN RAISE EXCEPTION 'El expediente no está en revisión.'; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.expediente_aprobar(p_admin BIGINT,p_id BIGINT) RETURNS VOID AS $$
BEGIN
    PERFORM identity.validar_revisor(p_admin);
    UPDATE identity.perfiles_tecnico SET estado_expediente='aprobado',estado_validacion='aprobado',
        nivel=3,validado_por=p_admin,fecha_validacion=clock_timestamp()
    WHERE usuario_id=p_id AND estado_expediente='en_revision' AND nivel=2
      AND email_verificado_en IS NOT NULL AND observaciones='{}'::jsonb;
    IF NOT FOUND THEN RAISE EXCEPTION 'El expediente no está listo para aprobar.'; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.expediente_rechazar(p_admin BIGINT,p_id BIGINT,p_motivo TEXT) RETURNS VOID AS $$
BEGIN
    PERFORM identity.validar_revisor(p_admin);
    IF length(btrim(COALESCE(p_motivo,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Indicá el motivo del rechazo.'; END IF;
    UPDATE identity.perfiles_tecnico SET estado_expediente='rechazado',estado_validacion='rechazado',
        validado_por=p_admin,fecha_validacion=clock_timestamp(),observaciones=jsonb_build_object('motivo',p_motivo)
    WHERE usuario_id=p_id AND estado_expediente IN ('en_revision','observado');
    IF NOT FOUND THEN RAISE EXCEPTION 'El expediente no está en revisión.'; END IF;
END;
$$ LANGUAGE plpgsql;

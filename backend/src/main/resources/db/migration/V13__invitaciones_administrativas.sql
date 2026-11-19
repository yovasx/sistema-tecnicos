CREATE TABLE admin_svc.invitaciones_usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    email TEXT NOT NULL,
    datos JSONB NOT NULL,
    permiso_hash TEXT NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expira_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()+INTERVAL '24 hours',
    consumida_en TIMESTAMPTZ,
    revocada BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_invitaciones_admin ON admin_svc.invitaciones_usuarios(admin_id,creado_en DESC);
CREATE INDEX idx_invitaciones_email ON admin_svc.invitaciones_usuarios(email,creado_en DESC);
ALTER TABLE admin_svc.auditoria_usuarios DROP CONSTRAINT auditoria_usuarios_accion_check;
ALTER TABLE admin_svc.auditoria_usuarios ADD CONSTRAINT auditoria_usuarios_accion_check
CHECK(accion IN ('crear','editar','desactivar','reactivar'));

CREATE FUNCTION admin_svc.invitar_usuario(p_admin BIGINT,p_email TEXT,p_datos JSONB,p_permiso TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM admin_svc.validar_gestion_usuarios(p_admin);
    IF p_email IS NULL OR length(p_email)>150 OR p_email NOT LIKE '%@%'
       OR p_datos->>'rol' NOT IN ('cliente','tecnico','administrador')
       OR p_datos->>'rol' IS NULL OR p_datos->>'tipoCliente' IS NULL
       OR p_datos->>'tipoCliente' NOT IN ('persona','empresa')
       OR (p_datos->>'tipoCliente'='empresa' AND p_datos->>'rol'<>'cliente')
       OR COALESCE(length(btrim(p_datos->>'nombre')),0) NOT BETWEEN 2 AND 100
       OR COALESCE(length(btrim(p_datos->>'apellido')),0) NOT BETWEEN 2 AND 100
       OR length(p_datos->>'telefono')>20
       OR (p_datos->>'tipoCliente'='empresa' AND (
           COALESCE(length(btrim(p_datos->>'razonSocial')),0) NOT BETWEEN 2 AND 150
           OR COALESCE(p_datos->>'nit','') !~ '^[0-9]{5,20}$'))
       OR p_permiso IS NULL OR length(p_permiso)<>64 THEN
        RAISE EXCEPTION 'Revisá los datos de la invitación.';
    END IF;
    IF EXISTS(SELECT 1 FROM identity.usuarios WHERE lower(email)=lower(btrim(p_email))
              AND eliminado_en IS NULL) THEN
        RAISE EXCEPTION 'Ya existe una cuenta con ese correo.' USING ERRCODE='P0409';
    END IF;
    IF (SELECT count(*) FROM admin_svc.invitaciones_usuarios
        WHERE admin_id=p_admin AND creado_en>clock_timestamp()-INTERVAL '24 hours')>=20
       OR EXISTS(SELECT 1 FROM admin_svc.invitaciones_usuarios WHERE email=lower(btrim(p_email))
           AND creado_en>clock_timestamp()-INTERVAL '60 seconds') THEN
        RAISE EXCEPTION 'Alcanzaste el límite de invitaciones. Esperá antes de volver a enviar.';
    END IF;
    UPDATE admin_svc.invitaciones_usuarios SET revocada=TRUE
    WHERE email=lower(btrim(p_email)) AND consumida_en IS NULL;
    INSERT INTO admin_svc.invitaciones_usuarios(admin_id,email,datos,permiso_hash)
    VALUES(p_admin,lower(btrim(p_email)),p_datos,encode(digest(p_permiso,'sha256'),'hex'));
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION admin_svc.aceptar_invitacion(p_email TEXT,p_permiso TEXT,p_hash TEXT)
RETURNS BOOLEAN AS $$
DECLARE v admin_svc.invitaciones_usuarios%ROWTYPE; v_id BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(1920381);
    SELECT * INTO v FROM admin_svc.invitaciones_usuarios
    WHERE email=lower(btrim(p_email)) AND permiso_hash=encode(digest(p_permiso,'sha256'),'hex')
      AND NOT revocada AND consumida_en IS NULL AND expira_en>clock_timestamp() FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF NOT EXISTS(SELECT 1 FROM identity.usuarios WHERE id=v.admin_id AND rol='administrador'
        AND activo AND eliminado_en IS NULL)
       OR EXISTS(SELECT 1 FROM identity.usuarios WHERE lower(email)=v.email AND eliminado_en IS NULL) THEN
        RETURN FALSE;
    END IF;
    INSERT INTO identity.usuarios(rol,tipo_cliente,nombre,apellido,email,telefono,password_hash,razon_social,nit)
    VALUES((v.datos->>'rol')::identity.rol_usuario,(v.datos->>'tipoCliente')::identity.tipo_cliente,
        btrim(v.datos->>'nombre'),btrim(v.datos->>'apellido'),v.email,NULLIF(btrim(v.datos->>'telefono'),''),
        p_hash,CASE WHEN v.datos->>'tipoCliente'='empresa' THEN btrim(v.datos->>'razonSocial') END,
        CASE WHEN v.datos->>'tipoCliente'='empresa' THEN v.datos->>'nit' END) RETURNING id INTO v_id;
    IF v.datos->>'rol'='tecnico' THEN
        INSERT INTO identity.perfiles_tecnico(usuario_id) VALUES(v_id);
    END IF;
    UPDATE admin_svc.invitaciones_usuarios SET consumida_en=clock_timestamp() WHERE id=v.id;
    INSERT INTO admin_svc.auditoria_usuarios(usuario_id,admin_id,accion,motivo,antes,despues)
    VALUES(v_id,v.admin_id,'crear','Alta por invitación aceptada por su destinatario','{}',admin_svc.usuario_json(v_id));
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

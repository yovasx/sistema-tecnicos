-- Gestión administrativa de cuentas sin exponer credenciales ni editar roles.
ALTER TABLE identity.usuarios ADD COLUMN revision_admin BIGINT NOT NULL DEFAULT 0;
CREATE FUNCTION identity.incrementar_revision_admin() RETURNS TRIGGER AS $$
BEGIN
    NEW.revision_admin := OLD.revision_admin + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_usuario_revision_admin BEFORE UPDATE ON identity.usuarios
FOR EACH ROW EXECUTE FUNCTION identity.incrementar_revision_admin();

CREATE TABLE admin_svc.auditoria_usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    admin_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    accion TEXT NOT NULL CHECK(accion IN ('editar', 'desactivar', 'reactivar')),
    motivo TEXT NOT NULL CHECK(length(btrim(motivo)) BETWEEN 5 AND 500),
    antes JSONB NOT NULL,
    despues JSONB NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_auditoria_usuarios ON admin_svc.auditoria_usuarios(usuario_id, id DESC);

CREATE FUNCTION admin_svc.usuario_json(p_id BIGINT) RETURNS JSONB AS $$
    SELECT jsonb_build_object('nombre', nombre, 'apellido', apellido,
        'telefono', telefono, 'razonSocial', razon_social, 'nit', nit, 'activo', activo)
    FROM identity.usuarios WHERE id=p_id;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION admin_svc.validar_gestion_usuarios(p_admin BIGINT) RETURNS VOID AS $$
BEGIN
    -- Serializa las gestiones de cuentas, también al contar administradores.
    PERFORM pg_advisory_xact_lock(1920381);
    PERFORM 1 FROM identity.usuarios WHERE id=p_admin AND rol='administrador'
        AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND OR orders.usuario_actual() IS DISTINCT FROM p_admin THEN
        RAISE EXCEPTION 'Se requiere un administrador activo.' USING ERRCODE='42501';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION admin_svc.editar_usuario(p_admin BIGINT, p_id BIGINT, p_revision BIGINT,
    p_nombre TEXT, p_apellido TEXT, p_telefono TEXT, p_razon TEXT, p_nit TEXT, p_motivo TEXT)
RETURNS VOID AS $$
DECLARE v identity.usuarios%ROWTYPE; v_antes JSONB;
BEGIN
    PERFORM admin_svc.validar_gestion_usuarios(p_admin);
    SELECT * INTO v FROM identity.usuarios WHERE id=p_id AND eliminado_en IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no existe.' USING ERRCODE='P0404'; END IF;
    IF p_revision IS NULL OR p_revision <> v.revision_admin THEN
        RAISE EXCEPTION 'La cuenta cambió. Recargá el detalle antes de guardar.' USING ERRCODE='P0409';
    END IF;
    IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 100
       OR p_apellido IS NULL OR length(btrim(p_apellido)) NOT BETWEEN 2 AND 100
       OR length(btrim(p_telefono)) > 20
       OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 500 THEN
        RAISE EXCEPTION 'Revisá los datos y escribí un motivo de entre 5 y 500 caracteres.';
    END IF;
    IF v.tipo_cliente='empresa' AND (
        p_razon IS NULL OR length(btrim(p_razon)) NOT BETWEEN 2 AND 150
        OR p_nit IS NULL OR btrim(p_nit) !~ '^[0-9]{5,20}$') THEN
        RAISE EXCEPTION 'Completá la razón social y un NIT de entre 5 y 20 dígitos.';
    END IF;
    -- Una identidad técnica aprobada no se cambia por un formulario genérico.
    IF v.rol='tecnico' AND EXISTS(SELECT 1 FROM identity.perfiles_tecnico
        WHERE usuario_id=p_id AND estado_validacion='aprobado')
       AND ROW(btrim(p_nombre), btrim(p_apellido)) IS DISTINCT FROM ROW(v.nombre, v.apellido) THEN
        RAISE EXCEPTION 'La identidad de un técnico aprobado requiere revisión documental.';
    END IF;
    v_antes := admin_svc.usuario_json(p_id);
    UPDATE identity.usuarios SET nombre=btrim(p_nombre), apellido=btrim(p_apellido),
        telefono=NULLIF(btrim(p_telefono),''),
        razon_social=CASE WHEN tipo_cliente='empresa' THEN btrim(p_razon) ELSE razon_social END,
        nit=CASE WHEN tipo_cliente='empresa' THEN btrim(p_nit) ELSE nit END
    WHERE id=p_id;
    INSERT INTO admin_svc.auditoria_usuarios(usuario_id,admin_id,accion,motivo,antes,despues)
    VALUES(p_id,p_admin,'editar',btrim(p_motivo),v_antes,admin_svc.usuario_json(p_id));
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION admin_svc.cambiar_estado_usuario(p_admin BIGINT, p_id BIGINT,
    p_revision BIGINT, p_activo BOOLEAN, p_motivo TEXT) RETURNS VOID AS $$
DECLARE v identity.usuarios%ROWTYPE; v_antes JSONB;
BEGIN
    PERFORM admin_svc.validar_gestion_usuarios(p_admin);
    SELECT * INTO v FROM identity.usuarios WHERE id=p_id AND eliminado_en IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no existe.' USING ERRCODE='P0404'; END IF;
    IF p_revision IS NULL OR p_revision <> v.revision_admin THEN
        RAISE EXCEPTION 'La cuenta cambió. Recargá el detalle antes de guardar.' USING ERRCODE='P0409';
    END IF;
    IF p_activo IS NULL OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 500 THEN
        RAISE EXCEPTION 'Indicá el estado y un motivo de entre 5 y 500 caracteres.';
    END IF;
    IF NOT p_activo AND p_admin=p_id THEN
        RAISE EXCEPTION 'No podés desactivar tu propia cuenta.';
    END IF;
    IF NOT p_activo AND v.rol='administrador' AND v.activo
       AND (SELECT count(*) FROM identity.usuarios
            WHERE rol='administrador' AND activo AND eliminado_en IS NULL) <= 1 THEN
        RAISE EXCEPTION 'La plataforma debe conservar un administrador activo.';
    END IF;
    IF v.activo=p_activo THEN RAISE EXCEPTION 'La cuenta ya tiene ese estado.'; END IF;
    IF NOT p_activo AND EXISTS(SELECT 1 FROM orders.ordenes_servicio
        WHERE (cliente_id=p_id OR tecnico_id=p_id) AND estado NOT IN ('finalizado','cancelado')) THEN
        RAISE EXCEPTION 'La cuenta tiene órdenes en curso. Resolvelas antes de desactivarla.';
    END IF;
    v_antes := admin_svc.usuario_json(p_id);
    UPDATE identity.usuarios SET activo=p_activo, version_sesion=version_sesion+1 WHERE id=p_id;
    INSERT INTO admin_svc.auditoria_usuarios(usuario_id,admin_id,accion,motivo,antes,despues)
    VALUES(p_id,p_admin,CASE WHEN p_activo THEN 'reactivar' ELSE 'desactivar' END,
        btrim(p_motivo),v_antes,admin_svc.usuario_json(p_id));
END;
$$ LANGUAGE plpgsql;

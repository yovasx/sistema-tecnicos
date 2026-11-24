-- Edición propia separada de la administración. Comparte la revisión de cuenta
-- para detectar también cambios concurrentes hechos desde el backoffice.
CREATE TABLE identity.auditoria_perfil (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    accion TEXT NOT NULL CHECK(accion IN ('editar', 'password')),
    antes JSONB NOT NULL,
    despues JSONB NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_auditoria_perfil_usuario ON identity.auditoria_perfil(usuario_id, id DESC);

CREATE FUNCTION identity.editar_perfil(p_id BIGINT, p_revision BIGINT,
    p_nombre TEXT, p_apellido TEXT, p_telefono TEXT, p_razon TEXT, p_nit TEXT)
RETURNS VOID AS $$
DECLARE v identity.usuarios%ROWTYPE; v_antes JSONB;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Solo podés editar tu propio perfil.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v FROM identity.usuarios
        WHERE id=p_id AND activo AND eliminado_en IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501'; END IF;
    IF v.rol='administrador' THEN
        RAISE EXCEPTION 'Usá el perfil administrativo con un motivo de edición.' USING ERRCODE='42501';
    END IF;
    IF p_revision IS NULL OR p_revision <> v.revision_admin THEN
        RAISE EXCEPTION 'Tu cuenta cambió. Recargá el perfil antes de guardar.' USING ERRCODE='P0409';
    END IF;
    IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 100
        OR p_apellido IS NULL OR length(btrim(p_apellido)) NOT BETWEEN 2 AND 100
        OR length(btrim(p_telefono)) > 20 THEN
        RAISE EXCEPTION 'Revisá el nombre, apellido y teléfono.';
    END IF;
    IF v.tipo_cliente='empresa' AND (
        p_razon IS NULL OR length(btrim(p_razon)) NOT BETWEEN 2 AND 150
        OR p_nit IS NULL OR btrim(p_nit) !~ '^[0-9]{5,20}$') THEN
        RAISE EXCEPTION 'Completá la razón social y un NIT de entre 5 y 20 dígitos.';
    END IF;
    IF v.rol='tecnico' AND EXISTS(SELECT 1 FROM identity.perfiles_tecnico
        WHERE usuario_id=p_id AND estado_validacion='aprobado')
        AND ROW(btrim(p_nombre),btrim(p_apellido)) IS DISTINCT FROM ROW(v.nombre,v.apellido) THEN
        RAISE EXCEPTION 'La identidad de un técnico aprobado requiere revisión documental.';
    END IF;
    v_antes := admin_svc.usuario_json(p_id);
    UPDATE identity.usuarios SET nombre=btrim(p_nombre), apellido=btrim(p_apellido),
        telefono=NULLIF(btrim(p_telefono),''),
        razon_social=CASE WHEN tipo_cliente='empresa' THEN btrim(p_razon) ELSE razon_social END,
        nit=CASE WHEN tipo_cliente='empresa' THEN btrim(p_nit) ELSE nit END
    WHERE id=p_id;
    INSERT INTO identity.auditoria_perfil(usuario_id,accion,antes,despues)
        VALUES(p_id,'editar',v_antes,admin_svc.usuario_json(p_id));
END;
$$ LANGUAGE plpgsql;

-- El propósito se fija al emitir el desafío y no se toma del token ni del
-- formulario de acceso. Un login desconocido nunca crea un cliente por defecto.
ALTER TABLE identity.desafios_google ADD COLUMN proposito TEXT NOT NULL DEFAULT 'acceso'
    CHECK(proposito IN ('acceso','cliente','tecnico','vinculacion'));

CREATE TABLE identity.auditoria_google (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    accion TEXT NOT NULL CHECK(accion IN ('registrar','vincular')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_auditoria_google_usuario ON identity.auditoria_google(usuario_id,id DESC);

CREATE FUNCTION identity.registrar_google_cuenta(p_sujeto TEXT,p_email TEXT,
    p_nombre TEXT,p_apellido TEXT,p_tipo TEXT) RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    IF p_tipo IS NULL OR p_tipo NOT IN ('cliente','tecnico') THEN
        RAISE EXCEPTION 'Selecciona un registro de cliente personal o técnico.';
    END IF;
    IF p_sujeto IS NULL OR btrim(p_sujeto)=''
        OR p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 100
        OR p_apellido IS NULL OR length(btrim(p_apellido)) NOT BETWEEN 2 AND 100 THEN
        RAISE EXCEPTION 'Completa un nombre y apellido de entre 2 y 100 caracteres.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_sujeto,7248));
    SELECT usuario_id INTO v_id FROM identity.identidades_google WHERE sujeto=p_sujeto;
    -- Una identidad existente conserva su usuario y su rol, sin conversiones.
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    IF EXISTS(SELECT 1 FROM identity.usuarios WHERE lower(email)=lower(btrim(p_email))) THEN
        RAISE EXCEPTION 'Este correo ya tiene una cuenta. Inicia sesión con tu método habitual para vincular Google.'
            USING ERRCODE='P0417';
    END IF;
    IF p_tipo='tecnico' THEN
        -- Reutilizar el alta oficial: crea el expediente requerido, en borrador,
        -- nivel 0, validación pendiente y disponibilidad fuera de servicio.
        v_id := identity.registrar_tecnico(p_nombre::varchar,p_apellido::varchar,
            p_email::varchar,NULL::varchar,NULL::varchar);
    ELSE
        v_id := identity.registrar_cliente(p_nombre::varchar,p_apellido::varchar,
            p_email::varchar,NULL::varchar,NULL::varchar,'persona',NULL::varchar,NULL::varchar);
    END IF;
    INSERT INTO identity.identidades_google(sujeto,usuario_id) VALUES(p_sujeto,v_id);
    INSERT INTO identity.auditoria_google(usuario_id,accion) VALUES(v_id,'registrar');
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION identity.vincular_google_cuenta(p_id BIGINT,p_sujeto TEXT) RETURNS VOID AS $$
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Solo puedes vincular Google a tu propia cuenta.' USING ERRCODE='42501';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_sujeto,7248));
    PERFORM 1 FROM identity.usuarios WHERE id=p_id AND activo AND eliminado_en IS NULL
        AND (rol='tecnico' OR (rol='cliente' AND tipo_cliente='persona'))
        AND password_hash IS NOT NULL FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no permite esta vinculación.' USING ERRCODE='42501';
    END IF;
    IF EXISTS(SELECT 1 FROM identity.identidades_google WHERE sujeto=p_sujeto OR usuario_id=p_id) THEN
        RAISE EXCEPTION 'La cuenta o identidad Google ya tiene una vinculación.' USING ERRCODE='P0418';
    END IF;
    INSERT INTO identity.identidades_google(sujeto,usuario_id) VALUES(p_sujeto,p_id);
    INSERT INTO identity.auditoria_google(usuario_id,accion) VALUES(p_id,'vincular');
END;
$$ LANGUAGE plpgsql;

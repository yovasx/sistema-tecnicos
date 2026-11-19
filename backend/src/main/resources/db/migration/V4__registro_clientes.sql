-- =============================================================================
-- V4: alta pública de clientes (persona / empresa)
-- =============================================================================
-- El registro no crea usuarios "a mano" desde Java: la regla vive acá, junto a
-- los CHECK de V3. El rol SIEMPRE es 'cliente'; el perfil (persona o empresa)
-- es lo único que elige quien se registra. Técnicos y administradores siguen
-- creándose por los flujos internos de validación.
--
-- No se agregan columnas ni tablas: alcanza con identity.usuarios de V1/V3.

CREATE OR REPLACE FUNCTION identity.registrar_cliente(
    p_nombre        VARCHAR,
    p_apellido      VARCHAR,
    p_email         VARCHAR,
    p_telefono      VARCHAR,
    p_password_hash VARCHAR,
    p_tipo_cliente  TEXT,
    p_razon_social  VARCHAR,
    p_nit           VARCHAR
) RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    IF p_tipo_cliente NOT IN ('persona', 'empresa') THEN
        RAISE EXCEPTION 'El perfil de cliente no es válido.' USING ERRCODE = 'P0001';
    END IF;

    IF p_tipo_cliente = 'empresa' AND (
        p_razon_social IS NULL OR btrim(p_razon_social) = ''
        OR p_nit IS NULL OR btrim(p_nit) = ''
    ) THEN
        RAISE EXCEPTION 'Para una cuenta de empresa necesitamos la razón social y el NIT.'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO identity.usuarios (
        rol, nombre, apellido, email, telefono, password_hash, activo,
        tipo_cliente, razon_social, nit
    )
    VALUES (
        'cliente'::identity.rol_usuario,
        btrim(p_nombre),
        btrim(p_apellido),
        lower(btrim(p_email)),
        NULLIF(btrim(p_telefono), ''),
        p_password_hash,
        TRUE,
        p_tipo_cliente::identity.tipo_cliente,
        CASE WHEN p_tipo_cliente = 'empresa' THEN btrim(p_razon_social) END,
        CASE WHEN p_tipo_cliente = 'empresa' THEN btrim(p_nit) END
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

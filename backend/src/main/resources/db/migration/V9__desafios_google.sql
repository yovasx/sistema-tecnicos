CREATE TABLE identity.desafios_google (
    nonce_hash TEXT PRIMARY KEY,
    expira_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()+INTERVAL '10 minutes',
    consumido BOOLEAN NOT NULL DEFAULT FALSE
);
-- El email identifica colisiones, nunca autoriza una vinculación automática.
CREATE FUNCTION identity.registrar_google(p_sujeto TEXT,p_email TEXT,p_nombre TEXT,p_apellido TEXT)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    -- Serializar altas de la misma identidad en diferentes dispositivos.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_sujeto,7248));
    SELECT usuario_id INTO v_id FROM identity.identidades_google WHERE sujeto=p_sujeto;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    IF EXISTS(SELECT 1 FROM identity.usuarios WHERE lower(email)=lower(p_email)) THEN
        RAISE EXCEPTION 'El email ya tiene cuenta. Iniciá sesión con tu contraseña para vincular Google.';
    END IF;
    v_id:=identity.registrar_cliente(p_nombre::varchar,p_apellido::varchar,p_email::varchar,
        NULL::varchar,NULL::varchar,'persona',NULL::varchar,NULL::varchar);
    INSERT INTO identity.identidades_google(sujeto,usuario_id) VALUES(p_sujeto,v_id);
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

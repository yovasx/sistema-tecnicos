-- La ubicación del cliente solo se comparte con consentimiento por orden.
-- No se conserva historial de sus coordenadas.
CREATE TABLE geo.sesiones_gps_cliente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    orden_id BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    version_sesion BIGINT NOT NULL,
    plataforma TEXT NOT NULL CHECK (plataforma IN ('web', 'android', 'ios')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expira_en TIMESTAMPTZ NOT NULL,
    expira_token_en TIMESTAMPTZ NOT NULL,
    cerrada_en TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_sesion_gps_cliente_activa
    ON geo.sesiones_gps_cliente(orden_id) WHERE cerrada_en IS NULL;
CREATE INDEX idx_sesiones_gps_cliente_expira
    ON geo.sesiones_gps_cliente(expira_en);

CREATE TABLE geo.ubicacion_cliente_actual (
    orden_id BIGINT PRIMARY KEY REFERENCES orders.ordenes_servicio(id),
    sesion_id UUID NOT NULL REFERENCES geo.sesiones_gps_cliente(id),
    punto geography(POINT, 4326) NOT NULL,
    precision_m REAL NOT NULL CHECK (precision_m BETWEEN 0 AND 200),
    capturado_en TIMESTAMPTZ NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION geo.iniciar_sesion_gps_cliente(
    p_orden BIGINT, p_plataforma TEXT, p_version BIGINT, p_expira TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
    v_cliente BIGINT := orders.usuario_actual();
    v_id UUID;
BEGIN
    IF p_plataforma IS NULL OR p_plataforma NOT IN ('web', 'android', 'ios') THEN
        RAISE EXCEPTION 'Selecciona una plataforma válida.';
    END IF;
    IF p_expira IS NULL OR p_expira <= clock_timestamp() THEN
        RAISE EXCEPTION 'La sesión venció.' USING ERRCODE = '42501';
    END IF;
    PERFORM 1 FROM identity.usuarios
        WHERE id = v_cliente AND rol = 'cliente' AND activo AND eliminado_en IS NULL
          AND version_sesion = p_version
        FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE = '42501';
    END IF;
    PERFORM 1 FROM orders.ordenes_servicio o
        JOIN identity.usuarios t ON t.id = o.tecnico_id AND t.rol = 'tecnico'
            AND t.activo AND t.eliminado_en IS NULL
        JOIN identity.perfiles_tecnico pt ON pt.usuario_id = t.id
            AND pt.estado_validacion = 'aprobado'
        WHERE o.id = p_orden AND o.cliente_id = v_cliente AND o.estado = 'en_camino'
        FOR UPDATE OF o;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El seguimiento no está disponible.' USING ERRCODE = 'P0404';
    END IF;

    UPDATE geo.sesiones_gps_cliente
        SET cerrada_en = COALESCE(cerrada_en, clock_timestamp())
        WHERE orden_id = p_orden AND cerrada_en IS NULL;
    DELETE FROM geo.ubicacion_cliente_actual WHERE orden_id = p_orden;
    INSERT INTO geo.sesiones_gps_cliente(
        cliente_id, orden_id, version_sesion, plataforma, expira_en, expira_token_en
    ) VALUES (
        v_cliente, p_orden, p_version, p_plataforma,
        LEAST(p_expira, clock_timestamp() + interval '30 seconds'), p_expira
    )
        RETURNING id INTO v_id;
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.detener_sesion_gps_cliente(p_sesion UUID) RETURNS VOID AS $$
DECLARE
    v_cliente BIGINT := orders.usuario_actual();
    v_orden BIGINT;
BEGIN
    SELECT orden_id INTO v_orden FROM geo.sesiones_gps_cliente
        WHERE id = p_sesion AND cliente_id = v_cliente;
    IF NOT FOUND THEN RETURN; END IF;
    PERFORM 1 FROM orders.ordenes_servicio WHERE id = v_orden FOR UPDATE;
    UPDATE geo.sesiones_gps_cliente
        SET cerrada_en = COALESCE(cerrada_en, clock_timestamp())
        WHERE id = p_sesion AND cliente_id = v_cliente;
    DELETE FROM geo.ubicacion_cliente_actual
        WHERE orden_id = v_orden AND sesion_id = p_sesion;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.reportar_posicion_sesion_cliente(
    p_sesion UUID, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION,
    p_precision REAL, p_capturado TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
    v_cliente BIGINT := orders.usuario_actual();
    v_s geo.sesiones_gps_cliente%ROWTYPE;
    v_orden orders.ordenes_servicio%ROWTYPE;
    v_ultima TIMESTAMPTZ;
    v_recepcion TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT * INTO v_s FROM geo.sesiones_gps_cliente
        WHERE id = p_sesion AND cliente_id = v_cliente;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El seguimiento no está disponible.' USING ERRCODE = 'P0424';
    END IF;
    SELECT * INTO v_orden FROM orders.ordenes_servicio
        WHERE id = v_s.orden_id AND cliente_id = v_cliente AND estado = 'en_camino'
        FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El seguimiento no está disponible.' USING ERRCODE = 'P0424';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM identity.usuarios u
        JOIN identity.perfiles_tecnico pt ON pt.usuario_id = u.id
            AND pt.estado_validacion = 'aprobado'
        WHERE u.id = v_orden.tecnico_id AND u.rol = 'tecnico'
          AND u.activo AND u.eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'El seguimiento no está disponible.' USING ERRCODE = 'P0424';
    END IF;
    SELECT * INTO v_s FROM geo.sesiones_gps_cliente WHERE id = p_sesion FOR UPDATE;
    v_recepcion := clock_timestamp();
    IF v_s.cerrada_en IS NOT NULL OR v_s.expira_en <= v_recepcion OR NOT EXISTS (
        SELECT 1 FROM identity.usuarios
        WHERE id = v_cliente AND rol = 'cliente' AND activo AND eliminado_en IS NULL
          AND version_sesion = v_s.version_sesion
    ) THEN
        RAISE EXCEPTION 'La sesión de seguimiento venció.' USING ERRCODE = 'P0424';
    END IF;
    IF p_lat IS NULL OR p_lat NOT BETWEEN -90 AND 90
        OR p_lng IS NULL OR p_lng NOT BETWEEN -180 AND 180
        OR p_precision IS NULL OR p_precision NOT BETWEEN 0 AND 200
        OR p_capturado IS NULL OR p_capturado < v_recepcion - interval '30 seconds'
        OR p_capturado > v_recepcion + interval '5 seconds' THEN
        RAISE EXCEPTION 'La ubicación debe ser reciente y tener una precisión de hasta 200 metros.';
    END IF;
    SELECT capturado_en INTO v_ultima FROM geo.ubicacion_cliente_actual
        WHERE orden_id = v_orden.id FOR UPDATE;
    IF v_ultima IS NOT NULL AND (
        p_capturado <= v_ultima OR EXISTS (
            SELECT 1 FROM geo.ubicacion_cliente_actual
            WHERE orden_id = v_orden.id
              AND actualizado_en > v_recepcion - interval '3 seconds'
        )
    ) THEN
        RETURN FALSE;
    END IF;
    INSERT INTO geo.ubicacion_cliente_actual(
        orden_id, sesion_id, punto, precision_m, capturado_en, actualizado_en
    ) VALUES (
        v_orden.id, p_sesion,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_precision, p_capturado, v_recepcion
    )
    ON CONFLICT (orden_id) DO UPDATE SET
        sesion_id = EXCLUDED.sesion_id,
        punto = EXCLUDED.punto,
        precision_m = EXCLUDED.precision_m,
        capturado_en = EXCLUDED.capturado_en,
        actualizado_en = EXCLUDED.actualizado_en;
    UPDATE geo.sesiones_gps_cliente
        SET expira_en = LEAST(expira_token_en, v_recepcion + interval '30 seconds')
        WHERE id = p_sesion;
    RETURN TRUE;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION geo.cerrar_gps_al_cambiar_orden() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado <> 'en_camino' THEN
        UPDATE geo.sesiones_seguimiento
            SET cerrada_en = COALESCE(cerrada_en, clock_timestamp())
            WHERE orden_id = NEW.id AND cerrada_en IS NULL;
        UPDATE geo.sesiones_gps_cliente
            SET cerrada_en = COALESCE(cerrada_en, clock_timestamp())
            WHERE orden_id = NEW.id AND cerrada_en IS NULL;
        DELETE FROM geo.ubicacion_actual WHERE orden_id = NEW.id;
        DELETE FROM geo.ubicacion_cliente_actual WHERE orden_id = NEW.id;
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

-- Seguimiento en tiempo real del técnico (F5). El esquema queda listo antes
-- que la capa Java para no mezclar la entrega de perfil con la de mapas.

-- 1. Posición del técnico ligada a la orden que la justifica ---------------
ALTER TABLE geo.ubicacion_actual ADD COLUMN orden_id BIGINT
    REFERENCES orders.ordenes_servicio(id);
ALTER TABLE geo.ubicacion_actual ADD COLUMN precision_m REAL
    CHECK (precision_m IS NULL OR precision_m >= 0);
CREATE INDEX idx_ubicacion_actual_orden ON geo.ubicacion_actual(orden_id)
    WHERE orden_id IS NOT NULL;

-- 2. Datos de seguimiento en la orden --------------------------------------
ALTER TABLE orders.ordenes_servicio ADD COLUMN direccion_id BIGINT
    REFERENCES identity.direcciones_cliente(id);
ALTER TABLE orders.ordenes_servicio ADD COLUMN distancia_estimada_m INTEGER
    CHECK (distancia_estimada_m IS NULL OR distancia_estimada_m >= 0);
ALTER TABLE orders.ordenes_servicio ADD COLUMN eta_estimada_min SMALLINT
    CHECK (eta_estimada_min IS NULL OR eta_estimada_min >= 0);

-- 3. Tickets de un solo uso para el handshake del WebSocket ----------------
-- El JWT nunca viaja en la URL. Se guarda solo el hash SHA-256, el ticket
-- vence en 60 segundos y sirve para una sola conexión y una sola orden.
CREATE TABLE identity.tickets_seguimiento (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash TEXT NOT NULL UNIQUE,
    usuario_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    orden_id BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    expira_en TIMESTAMPTZ NOT NULL,
    usado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tickets_seguimiento_hash_check CHECK (hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX idx_tickets_seguimiento_expira ON identity.tickets_seguimiento(expira_en);

-- 4. Reporte de posición ----------------------------------------------------
-- Solo el técnico asignado, solo mientras la orden está en camino o en
-- diagnóstico. Fuera de esos estados no se acepta ninguna posición.
CREATE FUNCTION geo.reportar_ubicacion_tecnico(p_tecnico_id BIGINT, p_orden_id BIGINT,
    p_latitud DOUBLE PRECISION, p_longitud DOUBLE PRECISION, p_precision REAL)
RETURNS VOID AS $$
DECLARE v_orden orders.ordenes_servicio%ROWTYPE;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_tecnico_id THEN
        RAISE EXCEPTION 'Solo puedes reportar tu propia ubicación.' USING ERRCODE='42501';
    END IF;
    IF p_latitud IS NULL OR p_latitud NOT BETWEEN -90 AND 90
        OR p_longitud IS NULL OR p_longitud NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'Las coordenadas no son válidas.';
    END IF;
    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id=p_orden_id;
    IF NOT FOUND OR v_orden.tecnico_id IS DISTINCT FROM p_tecnico_id THEN
        RAISE EXCEPTION 'La orden no está disponible.' USING ERRCODE='P0404';
    END IF;
    IF v_orden.estado NOT IN ('en_camino','en_diagnostico') THEN
        RAISE EXCEPTION 'La orden no admite seguimiento en este estado.' USING ERRCODE='P0424';
    END IF;
    INSERT INTO geo.ubicacion_actual(tecnico_id,punto,orden_id,precision_m,actualizado_en)
        VALUES(p_tecnico_id,
               ST_SetSRID(ST_MakePoint(p_longitud,p_latitud),4326)::geography,
               p_orden_id,p_precision,now())
        ON CONFLICT (tecnico_id) DO UPDATE SET
            punto=EXCLUDED.punto, orden_id=EXCLUDED.orden_id,
            precision_m=EXCLUDED.precision_m, actualizado_en=now();
    INSERT INTO geo.ubicaciones_historial(tecnico_id,orden_id,punto)
        VALUES(p_tecnico_id,p_orden_id,
               ST_SetSRID(ST_MakePoint(p_longitud,p_latitud),4326)::geography);
END $$ LANGUAGE plpgsql;

-- 5. Retención --------------------------------------------------------------
-- La última posición deja de existir cuando la orden se cierra; el historial
-- se purga por antigüedad. Ninguna posición sobrevive a la relación de servicio.
CREATE FUNCTION geo.cerrar_ubicacion_orden(p_orden_id BIGINT) RETURNS VOID AS $$
    DELETE FROM geo.ubicacion_actual WHERE orden_id=p_orden_id;
$$ LANGUAGE sql;

CREATE FUNCTION geo.purgar_ubicaciones(p_dias INT DEFAULT 30) RETURNS BIGINT AS $$
DECLARE v_borradas BIGINT;
BEGIN
    IF p_dias IS NULL OR p_dias < 1 THEN
        RAISE EXCEPTION 'El plazo de retención debe ser de al menos un día.';
    END IF;
    WITH borradas AS (
        DELETE FROM geo.ubicaciones_historial
        WHERE registrado_en < now() - make_interval(days => p_dias)
        RETURNING 1
    ) SELECT count(*) INTO v_borradas FROM borradas;
    RETURN v_borradas;
END $$ LANGUAGE plpgsql;

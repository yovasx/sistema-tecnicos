-- Alta del cliente e idempotencia persistente, sin modificar la máquina de estados.
CREATE TABLE orders.solicitudes_cliente (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    clave UUID NOT NULL,
    huella VARCHAR(64) NOT NULL CHECK (huella ~ '^[a-f0-9]{64}$'),
    orden_id BIGINT NOT NULL UNIQUE REFERENCES orders.ordenes_servicio(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cliente_id, clave)
);

CREATE INDEX idx_ordenes_cliente_fecha ON orders.ordenes_servicio(cliente_id, creado_en DESC, id DESC);

CREATE FUNCTION orders.crear_solicitud_cliente(p_clave UUID, p_huella TEXT, p_categoria INT,
    p_descripcion TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION,
    p_referencia TEXT, p_urgencia BOOLEAN, p_evidencia TEXT)
RETURNS TABLE(orden_id BIGINT, creada BOOLEAN) AS $$
DECLARE
    v_cliente BIGINT := orders.usuario_actual();
    v_previa orders.solicitudes_cliente%ROWTYPE;
    v_orden BIGINT;
BEGIN
    -- Compartido con la desactivación: no crear órdenes para una cuenta desactivada.
    PERFORM 1 FROM identity.usuarios WHERE id=v_cliente AND rol='cliente'
        AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solo un cliente activo puede solicitar servicios.' USING ERRCODE='42501'; END IF;
    IF p_clave IS NULL OR p_huella IS NULL OR p_huella !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'La clave de solicitud no es válida.';
    END IF;
    -- Serializa reintentos simultáneos; el índice único garantiza una orden por clave/cliente.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_cliente::text || ':' || p_clave::text, 0));
    SELECT * INTO v_previa FROM orders.solicitudes_cliente s
        WHERE s.cliente_id=v_cliente AND s.clave=p_clave;
    IF FOUND THEN
        IF v_previa.huella<>p_huella THEN
            RAISE EXCEPTION 'Esta clave ya corresponde a otra solicitud. Consultá Mis servicios antes de volver a enviar.'
                USING ERRCODE='P0412';
        END IF;
        RETURN QUERY SELECT v_previa.orden_id,false;
        RETURN;
    END IF;
    PERFORM 1 FROM orders.categorias_servicio WHERE id=p_categoria AND activa FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La categoría ya no está disponible. Elegí otra categoría activa.' USING ERRCODE='P0413';
    END IF;
    IF p_descripcion IS NULL OR length(btrim(p_descripcion)) NOT BETWEEN 10 AND 2000
       OR p_referencia IS NULL OR length(btrim(p_referencia)) NOT BETWEEN 5 AND 300
       OR p_lat IS NULL OR NOT (p_lat BETWEEN -90 AND 90)
       OR p_lng IS NULL OR NOT (p_lng BETWEEN -180 AND 180)
       OR p_urgencia IS NULL THEN
        RAISE EXCEPTION 'Revisá la descripción, dirección y coordenadas.';
    END IF;
    IF p_evidencia IS NOT NULL AND p_evidencia !~ '^/perfiles/[a-f0-9-]{36}\.(jpg|jpeg|png|pdf)$' THEN
        RAISE EXCEPTION 'La evidencia debe ser un archivo privado registrado por el servidor.';
    END IF;
    INSERT INTO orders.ordenes_servicio(cliente_id,categoria_id,descripcion_falla,
        ubicacion_cliente,direccion_referencia,tarifa_urgencia,foto_evidencia_url,estado)
    VALUES(v_cliente,p_categoria,btrim(p_descripcion),
        ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography,btrim(p_referencia),p_urgencia,p_evidencia,'solicitado')
    RETURNING id INTO v_orden;
    INSERT INTO orders.solicitudes_cliente(cliente_id,clave,huella,orden_id)
    VALUES(v_cliente,p_clave,p_huella,v_orden);
    -- El trigger existente registra el alta con app.usuario_id. No genera ofertas ni cotizaciones.
    RETURN QUERY SELECT v_orden,true;
END;
$$ LANGUAGE plpgsql;

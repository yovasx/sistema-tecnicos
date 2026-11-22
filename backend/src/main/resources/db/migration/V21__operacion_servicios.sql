-- Acciones operativas cerradas, no un selector libre de estados.
CREATE TABLE identity.auditoria_disponibilidad (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tecnico_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    antes identity.estado_disponibilidad NOT NULL,
    despues identity.estado_disponibilidad NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION orders.cambiar_disponibilidad(p_disponible BOOLEAN) RETURNS TEXT AS $$
DECLARE v_id BIGINT:=identity.tecnico_operativo(); v_estado identity.estado_disponibilidad;
    v_antes identity.estado_disponibilidad;
BEGIN
    IF p_disponible IS NULL THEN RAISE EXCEPTION 'Selecciona tu disponibilidad.'; END IF;
    IF EXISTS(SELECT 1 FROM orders.ordenes_servicio WHERE tecnico_id=v_id
        AND estado NOT IN ('finalizado','cancelado')) THEN
        RAISE EXCEPTION 'Termina tu servicio activo antes de cambiar la disponibilidad.' USING ERRCODE='P0409';
    END IF;
    IF p_disponible AND (NOT EXISTS(SELECT 1 FROM identity.tecnico_especialidades WHERE tecnico_id=v_id)
        OR NOT EXISTS(SELECT 1 FROM geo.zonas_cobertura WHERE tecnico_id=v_id AND activo)) THEN
        RAISE EXCEPTION 'Registra especialidades y cobertura antes de estar disponible.';
    END IF;
    v_estado:=CASE WHEN p_disponible THEN 'disponible' ELSE 'fuera_servicio' END;
    SELECT disponibilidad INTO v_antes FROM identity.perfiles_tecnico WHERE usuario_id=v_id;
    UPDATE identity.perfiles_tecnico SET disponibilidad=v_estado WHERE usuario_id=v_id;
    IF v_antes IS DISTINCT FROM v_estado THEN
        INSERT INTO identity.auditoria_disponibilidad(tecnico_id,antes,despues) VALUES(v_id,v_antes,v_estado);
    END IF;
    RETURN v_estado::text;
END $$ LANGUAGE plpgsql;

ALTER TABLE chat.mensajes ADD COLUMN clave UUID;
CREATE UNIQUE INDEX uq_mensaje_clave ON chat.mensajes(emisor_id,clave) WHERE clave IS NOT NULL;
CREATE INDEX idx_mensajes_emisor_fecha ON chat.mensajes(emisor_id,enviado_en);
CREATE FUNCTION chat.enviar_mensaje_propio(p_orden BIGINT,p_clave UUID,p_contenido TEXT) RETURNS BIGINT AS $$
DECLARE v_actor BIGINT:=orders.usuario_actual(); v_c chat.conversaciones%ROWTYPE;
    v_previo chat.mensajes%ROWTYPE; v_id BIGINT;
BEGIN
    PERFORM 1 FROM identity.usuarios WHERE id=v_actor AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501'; END IF;
    IF p_clave IS NULL OR p_contenido IS NULL OR length(btrim(p_contenido)) NOT BETWEEN 1 AND 2000 THEN
        RAISE EXCEPTION 'Escribe un mensaje de hasta 2000 caracteres.';
    END IF;
    SELECT * INTO v_c FROM chat.conversaciones WHERE orden_id=p_orden
        AND v_actor IN (cliente_id,tecnico_id) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La conversación no está disponible.' USING ERRCODE='P0424'; END IF;
    SELECT * INTO v_previo FROM chat.mensajes WHERE emisor_id=v_actor AND clave=p_clave;
    IF FOUND THEN
        IF v_previo.conversacion_id<>v_c.id OR v_previo.contenido<>btrim(p_contenido) THEN
            RAISE EXCEPTION 'La clave corresponde a otro mensaje.' USING ERRCODE='P0409';
        END IF;
        RETURN v_previo.id;
    END IF;
    IF NOT v_c.abierta THEN RAISE EXCEPTION 'La conversación está cerrada.' USING ERRCODE='P0409'; END IF;
    IF (SELECT count(*) FROM chat.mensajes WHERE emisor_id=v_actor AND enviado_en>clock_timestamp()-interval '10 seconds')>=20 THEN
        RAISE EXCEPTION 'Espera unos segundos antes de enviar otro mensaje.' USING ERRCODE='P0409';
    END IF;
    INSERT INTO chat.mensajes(conversacion_id,emisor_id,tipo,contenido,clave)
        VALUES(v_c.id,v_actor,'texto',btrim(p_contenido),p_clave) RETURNING id INTO v_id;
    INSERT INTO notification.notificaciones(usuario_id,orden_id,tipo,mensaje)
        VALUES(CASE WHEN v_actor=v_c.cliente_id THEN v_c.tecnico_id ELSE v_c.cliente_id END,
            p_orden,'mensaje_chat','Tienes un nuevo mensaje en tu servicio.');
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.tomar_servicio(p_orden BIGINT) RETURNS BOOLEAN AS $$
DECLARE v_id BIGINT:=identity.tecnico_operativo(); v_o orders.ordenes_servicio%ROWTYPE; v_oferta BIGINT;
BEGIN
    -- Reintentar la propia aceptación es idempotente.
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud no está disponible.' USING ERRCODE='P0424'; END IF;
    IF v_o.tecnico_id=v_id AND v_o.estado='en_camino' THEN RETURN TRUE; END IF;
    IF v_o.estado<>'solicitado' OR v_o.tecnico_id IS NOT NULL OR NOT EXISTS(
        SELECT 1 FROM identity.perfiles_tecnico WHERE usuario_id=v_id AND disponibilidad='disponible')
        OR EXISTS(SELECT 1 FROM orders.ordenes_servicio WHERE tecnico_id=v_id
            AND estado NOT IN ('finalizado','cancelado')) THEN
        RAISE EXCEPTION 'La solicitud o tu disponibilidad cambió. Actualiza el panel.' USING ERRCODE='P0409';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM identity.usuarios WHERE id=v_o.cliente_id AND activo AND eliminado_en IS NULL)
        OR NOT EXISTS(SELECT 1 FROM orders.categorias_servicio WHERE id=v_o.categoria_id AND activa)
        OR NOT EXISTS(SELECT 1 FROM identity.tecnico_especialidades
            WHERE tecnico_id=v_id AND categoria_id=v_o.categoria_id)
        OR NOT EXISTS(SELECT 1 FROM geo.zonas_cobertura WHERE tecnico_id=v_id AND activo
            AND ST_Covers(poligono::geometry,v_o.ubicacion_cliente::geometry)) THEN
        RAISE EXCEPTION 'La solicitud no coincide con tu especialidad o cobertura.' USING ERRCODE='42501';
    END IF;
    INSERT INTO orders.ofertas_orden(orden_id,tecnico_id,expira_en)
        VALUES(p_orden,v_id,now()+interval '1 minute')
        ON CONFLICT(orden_id,tecnico_id) DO UPDATE SET estado='enviada',
            enviada_en=now(),expira_en=now()+interval '1 minute',respondida_en=NULL
        RETURNING id INTO v_oferta;
    RETURN orders.aceptar_oferta(v_oferta,v_id);
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.cancelar_solicitud_propia(p_orden BIGINT,p_motivo TEXT) RETURNS VOID AS $$
DECLARE v_id BIGINT:=orders.usuario_actual(); v_o orders.ordenes_servicio%ROWTYPE;
BEGIN
    PERFORM 1 FROM identity.usuarios WHERE id=v_id AND rol='cliente' AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden AND cliente_id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud no está disponible.' USING ERRCODE='P0424'; END IF;
    IF v_o.estado='cancelado' AND v_o.cancelado_por=v_id THEN RETURN; END IF;
    IF v_o.estado<>'solicitado' OR v_o.tecnico_id IS NOT NULL THEN
        RAISE EXCEPTION 'Solo puedes cancelar una solicitud todavía no asignada.' USING ERRCODE='P0409';
    END IF;
    IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 500 THEN
        RAISE EXCEPTION 'Describe el motivo en entre 5 y 500 caracteres.';
    END IF;
    UPDATE orders.ordenes_servicio SET estado='cancelado',motivo_cancelacion=btrim(p_motivo),
        cancelado_por=v_id WHERE id=p_orden;
    UPDATE orders.ofertas_orden SET estado='cerrada',respondida_en=now()
        WHERE orden_id=p_orden AND estado='enviada';
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.avanzar_servicio_propio(p_orden BIGINT,p_accion TEXT) RETURNS VOID AS $$
DECLARE v_id BIGINT:=identity.tecnico_operativo(); v_o orders.ordenes_servicio%ROWTYPE; v_destino orders.estado_orden;
BEGIN
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden AND tecnico_id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El servicio no está disponible.' USING ERRCODE='P0424'; END IF;
    v_destino:=CASE p_accion WHEN 'llegada' THEN 'en_diagnostico'::orders.estado_orden
        WHEN 'reparacion' THEN 'en_reparacion'::orders.estado_orden
        WHEN 'finalizar' THEN 'finalizado'::orders.estado_orden ELSE NULL END;
    IF v_destino IS NULL THEN RAISE EXCEPTION 'La acción no está permitida.'; END IF;
    IF v_o.estado=v_destino THEN RETURN; END IF;
    IF (p_accion='llegada' AND v_o.estado<>'en_camino')
        OR (p_accion='reparacion' AND v_o.estado<>'en_diagnostico')
        OR (p_accion='finalizar' AND v_o.estado<>'en_reparacion') THEN
        RAISE EXCEPTION 'El estado del servicio cambió. Actualiza el detalle.' USING ERRCODE='P0409';
    END IF;
    IF p_accion IN ('reparacion','finalizar') AND (
        NOT EXISTS(SELECT 1 FROM billing.cotizaciones WHERE orden_id=p_orden
            AND estado='aceptada' AND creada_por=v_id)
        OR EXISTS(SELECT 1 FROM billing.cotizaciones WHERE orden_id=p_orden AND estado='enviada')) THEN
        RAISE EXCEPTION 'El cliente debe aceptar la cotización antes de continuar.' USING ERRCODE='P0409';
    END IF;
    UPDATE orders.ordenes_servicio SET estado=v_destino WHERE id=p_orden;
END $$ LANGUAGE plpgsql;

CREATE TABLE billing.envios_tecnico (
    tecnico_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    clave UUID NOT NULL,
    huella TEXT NOT NULL,
    cotizacion_id BIGINT NOT NULL REFERENCES billing.cotizaciones(id),
    PRIMARY KEY(tecnico_id,clave)
);
CREATE FUNCTION billing.preparar_cotizacion_propia(p_orden BIGINT,p_clave UUID,p_motivo TEXT,p_items JSONB)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT:=identity.tecnico_operativo(); v_o orders.ordenes_servicio%ROWTYPE;
    v_huella TEXT; v_previa billing.envios_tecnico%ROWTYPE; v_cot BIGINT; v_item JSONB;
    v_cantidad NUMERIC; v_precio NUMERIC; v_total NUMERIC:=0;
BEGIN
    IF p_clave IS NULL THEN RAISE EXCEPTION 'La clave de cotización no es válida.'; END IF;
    v_huella:=encode(digest(p_orden::text||COALESCE(p_motivo,'')||COALESCE(p_items::text,''),'sha256'),'hex');
    SELECT * INTO v_previa FROM billing.envios_tecnico WHERE tecnico_id=v_id AND clave=p_clave;
    IF FOUND THEN
        IF v_previa.huella<>v_huella THEN RAISE EXCEPTION 'Esta clave ya corresponde a otra cotización.' USING ERRCODE='P0409'; END IF;
        RETURN v_previa.cotizacion_id;
    END IF;
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden AND tecnico_id=v_id FOR UPDATE;
    IF NOT FOUND OR v_o.estado NOT IN ('en_diagnostico','en_reparacion') THEN
        RAISE EXCEPTION 'El servicio no admite una cotización.' USING ERRCODE='P0424';
    END IF;
    IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 1000 OR
        p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN
        RAISE EXCEPTION 'Describe el diagnóstico y agrega entre 1 y 20 conceptos.';
    END IF;
    INSERT INTO billing.cotizaciones(orden_id,moneda,creada_por,motivo)
        VALUES(p_orden,'BOB',v_id,btrim(p_motivo)) RETURNING id INTO v_cot;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        IF v_item->>'tipo' IS NULL OR v_item->>'tipo' NOT IN ('visita','mano_obra','repuesto','desplazamiento','urgencia','otro')
            OR v_item->>'descripcion' IS NULL OR length(btrim(v_item->>'descripcion')) NOT BETWEEN 2 AND 200
            OR jsonb_typeof(v_item->'cantidad') IS DISTINCT FROM 'number'
            OR jsonb_typeof(v_item->'precioUnitario') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Revisa los conceptos de la cotización.';
        END IF;
        v_cantidad:=(v_item->>'cantidad')::numeric; v_precio:=(v_item->>'precioUnitario')::numeric;
        IF v_cantidad NOT BETWEEN 0.01 AND 999999.99 OR v_precio NOT BETWEEN 0 AND 99999999.99
            OR round(v_cantidad,2)<>v_cantidad OR round(v_precio,2)<>v_precio
            OR v_cantidad*v_precio>9999999999.99 THEN RAISE EXCEPTION 'Los importes no son válidos.'; END IF;
        v_total:=v_total+round(v_cantidad*v_precio,2);
        IF v_total>9999999999.99 THEN RAISE EXCEPTION 'El total excede el importe permitido.'; END IF;
        INSERT INTO billing.cotizacion_items(cotizacion_id,tipo,descripcion,cantidad,precio_unitario)
            VALUES(v_cot,(v_item->>'tipo')::billing.tipo_item,btrim(v_item->>'descripcion'),v_cantidad,v_precio);
    END LOOP;
    PERFORM billing.enviar_cotizacion(v_cot,v_id,30);
    INSERT INTO billing.envios_tecnico(tecnico_id,clave,huella,cotizacion_id) VALUES(v_id,p_clave,v_huella,v_cot);
    RETURN v_cot;
END $$ LANGUAGE plpgsql;

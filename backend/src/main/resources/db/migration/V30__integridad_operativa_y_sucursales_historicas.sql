ALTER TABLE orders.equipos_orden ADD COLUMN sucursal_id BIGINT REFERENCES identity.sucursales_cliente(id);
UPDATE orders.equipos_orden h SET sucursal_id=e.sucursal_id FROM orders.equipos_cliente e
WHERE e.id=h.equipo_id;

CREATE OR REPLACE FUNCTION orders.vincular_equipo(p_orden BIGINT,p_equipo BIGINT) RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio; v_e orders.equipos_cliente; v_sucursal TEXT;
BEGIN
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden AND cliente_id=orders.usuario_actual() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La orden no está disponible.' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM orders.equipos_orden WHERE orden_id=p_orden AND equipo_id=p_equipo) THEN RETURN; END IF;
    IF v_o.estado<>'solicitado' OR EXISTS(SELECT 1 FROM orders.equipos_orden WHERE orden_id=p_orden) THEN
        RAISE EXCEPTION 'No puedes cambiar el equipo de una solicitud enviada.' USING ERRCODE='P0409'; END IF;
    SELECT * INTO v_e FROM orders.equipos_cliente WHERE id=p_equipo AND cliente_id=v_o.cliente_id AND activo FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El equipo no está disponible.' USING ERRCODE='42501'; END IF;
    SELECT nombre INTO v_sucursal FROM identity.sucursales_cliente WHERE id=v_e.sucursal_id AND activa;
    IF v_e.sucursal_id IS NOT NULL AND v_sucursal IS NULL THEN
        RAISE EXCEPTION 'La sucursal del equipo está archivada.' USING ERRCODE='P0409'; END IF;
    INSERT INTO orders.equipos_orden(orden_id,equipo_id,nombre_snapshot,sucursal_snapshot,sucursal_id)
    VALUES(p_orden,p_equipo,v_e.nombre,v_sucursal,v_e.sucursal_id);
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.detener_seguimiento_por_pausa() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pausa_motivo IS NOT NULL THEN
        UPDATE geo.sesiones_seguimiento SET cerrada_en=coalesce(cerrada_en,clock_timestamp()) WHERE orden_id=NEW.orden_id AND cerrada_en IS NULL;
        UPDATE geo.sesiones_gps_cliente SET cerrada_en=coalesce(cerrada_en,clock_timestamp()) WHERE orden_id=NEW.orden_id AND cerrada_en IS NULL;
        DELETE FROM geo.ubicacion_actual WHERE orden_id=NEW.orden_id;
        DELETE FROM geo.ubicacion_cliente_actual WHERE orden_id=NEW.orden_id;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_pausa_seguimiento AFTER UPDATE OF pausa_motivo ON orders.atenciones
FOR EACH ROW EXECUTE FUNCTION orders.detener_seguimiento_por_pausa();
CREATE FUNCTION geo.exigir_atencion_no_pausada() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM orders.atenciones WHERE orden_id=NEW.orden_id AND pausa_motivo IS NOT NULL) THEN
        RAISE EXCEPTION 'La atención está pausada. Reanuda antes de compartir ubicación.' USING ERRCODE='P0409'; END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_sesion_tecnico_no_pausada BEFORE INSERT ON geo.sesiones_seguimiento
FOR EACH ROW EXECUTE FUNCTION geo.exigir_atencion_no_pausada();
CREATE TRIGGER tr_sesion_cliente_no_pausada BEFORE INSERT ON geo.sesiones_gps_cliente
FOR EACH ROW EXECUTE FUNCTION geo.exigir_atencion_no_pausada();
ALTER FUNCTION orders.verificar_llegada(BIGINT,TEXT) RENAME TO verificar_llegada_base_v26;
CREATE FUNCTION orders.verificar_llegada(p_orden BIGINT,p_codigo TEXT) RETURNS BOOLEAN AS $$
BEGIN
    PERFORM orders.bloquear_atencion(p_orden);
    IF EXISTS(SELECT 1 FROM orders.atenciones WHERE orden_id=p_orden AND pausa_motivo IS NOT NULL) THEN RETURN FALSE; END IF;
    RETURN orders.verificar_llegada_base_v26(p_orden,p_codigo);
END $$ LANGUAGE plpgsql;

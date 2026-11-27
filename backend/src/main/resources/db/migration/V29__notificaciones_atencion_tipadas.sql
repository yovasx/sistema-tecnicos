CREATE OR REPLACE FUNCTION orders.registrar_evento_atencion(p_orden BIGINT,p_accion TEXT,p_motivo TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE orders.atenciones SET revision=revision+1 WHERE orden_id=p_orden;
    INSERT INTO orders.eventos_atencion(orden_id,actor_id,accion,motivo)
    VALUES(p_orden,orders.usuario_actual(),p_accion,p_motivo);
    INSERT INTO notification.notificaciones(usuario_id,orden_id,tipo,mensaje)
    SELECT cliente_id,id,'cambio_estado'::notification.tipo_notificacion,p_motivo FROM orders.ordenes_servicio
    WHERE id=p_orden AND cliente_id IS DISTINCT FROM orders.usuario_actual()
    UNION ALL
    SELECT tecnico_id,id,'cambio_estado'::notification.tipo_notificacion,p_motivo FROM orders.ordenes_servicio
    WHERE id=p_orden AND tecnico_id IS NOT NULL AND tecnico_id IS DISTINCT FROM orders.usuario_actual();
END $$ LANGUAGE plpgsql;

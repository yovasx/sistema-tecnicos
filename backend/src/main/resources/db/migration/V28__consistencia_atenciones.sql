-- También el cliente/coordinador toma el perfil antes de la orden al cerrar:
-- evita invertir el orden de locks respecto de la aceptación técnica.
CREATE OR REPLACE FUNCTION orders.bloquear_atencion(p_orden BIGINT,p_revision BIGINT DEFAULT NULL)
RETURNS orders.ordenes_servicio AS $$
DECLARE v_o orders.ordenes_servicio; v_actor BIGINT:=orders.usuario_actual(); v_rol TEXT; v_rev BIGINT; v_tecnico BIGINT;
BEGIN
    SELECT rol::text INTO v_rol FROM identity.usuarios
    WHERE id=v_actor AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501'; END IF;
    SELECT tecnico_id INTO v_tecnico FROM orders.ordenes_servicio
    WHERE id=p_orden AND (cliente_id=v_actor OR tecnico_id=v_actor OR v_rol='administrador');
    IF NOT FOUND THEN RAISE EXCEPTION 'La atención no está disponible.' USING ERRCODE='P0425'; END IF;
    IF v_rol='tecnico' THEN PERFORM identity.tecnico_operativo();
    ELSIF v_tecnico IS NOT NULL THEN
        PERFORM 1 FROM identity.perfiles_tecnico WHERE usuario_id=v_tecnico FOR UPDATE;
    END IF;
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden FOR UPDATE;
    IF v_rol<>'administrador' AND v_actor<>v_o.cliente_id AND v_actor IS DISTINCT FROM v_o.tecnico_id THEN
        RAISE EXCEPTION 'La atención no está disponible.' USING ERRCODE='P0425'; END IF;
    SELECT revision INTO v_rev FROM orders.atenciones WHERE orden_id=p_orden FOR UPDATE;
    IF p_revision IS NOT NULL AND p_revision<>v_rev THEN
        RAISE EXCEPTION 'La atención cambió. Actualiza antes de continuar.' USING ERRCODE='P0409'; END IF;
    RETURN v_o;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.proteger_etapa_atencion() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM orders.atenciones WHERE orden_id=NEW.orden_id AND entregado_en IS NOT NULL) THEN
        RAISE EXCEPTION 'La entrega ya fue registrada. No puedes agregar otra cotización.' USING ERRCODE='P0409';
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_proteger_cotizacion_entrega BEFORE INSERT ON billing.cotizaciones
FOR EACH ROW EXECUTE FUNCTION orders.proteger_etapa_atencion();

-- No hay cargos automáticos por visita fallida o diagnóstico no autorizado.
-- La cancelación conserva el técnico y el historial; una nueva atención requiere nueva solicitud.
CREATE FUNCTION orders.sincronizar_busqueda() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado='cancelado' THEN
        UPDATE orders.busquedas_servicio SET estado='cancelada' WHERE orden_id=NEW.id;
    ELSIF NEW.tecnico_id IS NOT NULL THEN
        UPDATE orders.busquedas_servicio SET estado='asignada' WHERE orden_id=NEW.id;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_sincronizar_busqueda AFTER UPDATE OF estado,tecnico_id ON orders.ordenes_servicio
FOR EACH ROW EXECUTE FUNCTION orders.sincronizar_busqueda();

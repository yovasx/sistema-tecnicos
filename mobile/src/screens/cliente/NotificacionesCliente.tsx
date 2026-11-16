import { PantallaPendiente } from '../../ui/PantallaPendiente';

/** F24: el catálogo de notificaciones ya está definido en notification.tipo_notificacion. */
export function NotificacionesCliente() {
  return (
    <PantallaPendiente
      titulo="Notificaciones"
      descripcion="El catálogo de la base cubre oferta_orden, cambio_estado, cotización, tarifa_urgencia, mensaje_chat, pago, disputa y sistema. Falta el endpoint y los push, que van con RabbitMQ."
      pantallaStitch="Fixly · Notificaciones del cliente (F24)"
    />
  );
}

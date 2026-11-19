import { PantallaPendiente } from '../../ui/PantallaPendiente';

/**
 * Secciones del backoffice cuyo endpoint todavía no existe.
 * Cada una lleva el banner ámbar y la pantalla de Stitch que la va a implementar.
 */

export function OrdenesAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Órdenes"
      descripcion="Tablero de órdenes con estado, técnico asignado y filtros. Depende del controlador de orders, que aún no existe."
      pantallaStitch="Fixly Admin - Órdenes (W46)"
      motivo="sprint"
    />
  );
}

export function MapaAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Mapa en vivo"
      descripcion="Posición de técnicos en ruta sobre el mapa de La Paz. Necesita el endpoint de ubicaciones y el mapa."
      pantallaStitch="Fixly Admin - Mapa en vivo (W45)"
      motivo="sprint"
    />
  );
}

export function DisputasAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Disputas"
      descripcion="Disputas abiertas, en revisión y resueltas (admin_svc.estado_disputa ya existe en la base). Falta el endpoint."
      pantallaStitch="Fixly Admin - Disputas (W50)"
      motivo="sprint"
    />
  );
}

export function AuditoriaAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Auditoría por tablas"
      descripcion="Consulta de la auditoría que ya escriben los triggers (app.usuario_id). Falta el endpoint de lectura."
      pantallaStitch="Fixly Admin - W51 Auditoría por tablas"
      motivo="sprint"
    />
  );
}

export function PagosAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Pagos"
      descripcion="Comprobantes y pagos QR Simple. El flujo vive en billing.responder_cotizacion; la vista admin falta."
      pantallaStitch="SCREEN W53 · Pagos"
      motivo="sprint"
    />
  );
}

export function LiquidacionesAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Liquidaciones y desembolsos"
      descripcion="Liquidaciones de comisión y desembolsos a técnicos (billing.estado_liquidacion existe). Falta el endpoint."
      pantallaStitch="SCREEN W54 · Liquidaciones y desembolsos"
      motivo="sprint"
    />
  );
}

export function ReportesAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Reportes exportables"
      descripcion="Reportes de ingresos, comisiones y tiempos de respuesta, exportables. Pendiente de endpoints de lectura."
      pantallaStitch="SCREEN W58 · Reportes exportables"
      motivo="sprint"
    />
  );
}

export function NotificacionesAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Notificaciones"
      descripcion="Bandeja de notificaciones del sistema (notification.tipo_notificacion ya está definido). Falta el endpoint."
      pantallaStitch="Fixly Admin - W57 Notificaciones"
      motivo="sprint"
    />
  );
}

export function ModeracionChatAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Moderación de chat"
      descripcion="Mensajes reportados y acciones de moderación. Requiere el endpoint de chat y cola de revisión."
      pantallaStitch="SCREEN W59 · Moderación de chat"
      motivo="sprint"
    />
  );
}

export function ConfiguracionAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Configuración"
      descripcion="Parámetros de la plataforma: comisión default, zonas, horarios. Tabla y API de V2."
      pantallaStitch="SCREEN W60 · Configuración (PENDIENTE DE V2)"
      motivo="v2"
    />
  );
}

export function SoporteAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Soporte"
      descripcion="Tickets de soporte con estado y respuesta desde el backoffice. Tabla y API de V2."
      pantallaStitch="SCREEN W55 · Tickets de soporte (V2)"
      motivo="v2"
    />
  );
}

export function PenalizacionesAdminScreen() {
  return (
    <PantallaPendiente
      titulo="Penalizaciones"
      descripcion="Registro de penalizaciones a técnicos y su impacto en la reputación. Tabla y API de V2."
      pantallaStitch="SCREEN W56 · Penalizaciones (PENDIENTE DE V2)"
      motivo="v2"
    />
  );
}

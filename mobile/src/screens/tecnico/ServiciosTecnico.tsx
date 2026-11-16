import { PantallaPendiente } from '../../ui/PantallaPendiente';

/** F37: servicios del técnico piden orders y billing, todavía sin controlador. */
export function ServiciosTecnico() {
  return (
    <PantallaPendiente
      titulo="Mis servicios"
      descripcion="Órdenes finalizadas, diagnóstico (F32), constructor de cotización (F33) y recotizaciones. Las funciones de cotización ya están en billing; falta el endpoint."
      pantallaStitch="Fixly · Mis servicios del técnico (F37)"
    />
  );
}

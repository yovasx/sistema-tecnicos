import { PantallaPendiente } from '../../ui/PantallaPendiente';

/** Las órdenes de la empresa piden la API de orders, todavía sin controlador. */
export function OrdenesEmpresa() {
  return (
    <PantallaPendiente
      titulo="Órdenes"
      descripcion="Listado de órdenes de la empresa con estado, técnico asignado y totales. Depende del controlador de orders y de la máquina de estados que ya vive en Postgres."
      pantallaStitch="Fixly · Seguimiento orden #1042 (F15)"
    />
  );
}

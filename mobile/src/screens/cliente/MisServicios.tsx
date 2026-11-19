import { PantallaPendiente } from '../../ui/PantallaPendiente';

/** F15: las órdenes del cliente piden la API de orders, todavía sin controlador. */
export function MisServicios() {
  return (
    <PantallaPendiente
      titulo="Mis servicios"
      descripcion="Las órdenes, sus estados y el seguimiento en ruta viven de la API de orders (máquina de estados en Postgres). Cuando el controlador exista, esta pantalla se conecta sin tocar la navegación."
      pantallaStitch="Fixly · Seguimiento orden #1042 (F15)"
    />
  );
}

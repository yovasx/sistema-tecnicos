import { MisServicios } from '../cliente/MisServicios';

/** La empresa comparte el listado de órdenes del cliente; solo cambia el título. */
export function OrdenesEmpresa() {
  return <MisServicios titulo="Órdenes" />;
}

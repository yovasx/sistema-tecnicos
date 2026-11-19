/**
 * Catálogo público de Fixly.
 *
 * Es lo único que la landing puede mostrar sin sesión: nombre, descripción y
 * tarifas de cada categoría. La comisión de la plataforma y los ids internos no
 * viajan al cliente.
 */
export interface CategoriaPublica {
  nombre: string;
  descripcion: string | null;
  tarifaVisita: number | null;
  tarifaHora: number | null;
  moneda: string | null;
}

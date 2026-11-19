import { CategoriaPublica } from '../models/Publico';

/** Puerto de lectura del catálogo que alimenta las landings. */
export interface PublicoRepository {
  categorias(): Promise<CategoriaPublica[]>;
}

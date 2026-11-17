import {
  CategoriaAdmin,
  ResumenAdmin,
  TecnicoPendiente,
  UsuarioAdmin,
} from '../models/Admin';

/** Puerto de lectura del backoffice. */
export interface AdminRepository {
  resumen(): Promise<ResumenAdmin>;
  usuarios(): Promise<UsuarioAdmin[]>;
  categorias(): Promise<CategoriaAdmin[]>;
  tecnicosPendientes(): Promise<TecnicoPendiente[]>;
}

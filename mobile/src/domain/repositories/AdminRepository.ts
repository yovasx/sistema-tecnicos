import {
  CategoriaAdmin,
  GuardarCategoriaInput,
  ResumenAdmin,
  TecnicoPendiente,
  UsuarioAdmin,
  FiltrosUsuarios, PaginaUsuarios, DetalleUsuarioAdmin, EditarUsuarioAdmin, EstadoUsuarioAdmin, CambioUsuarioAdmin, InvitacionUsuarioAdmin,
} from '../models/Admin';

/** Puerto del backoffice: lecturas y escritura administrada del catálogo. */
export interface AdminRepository {
  resumen(): Promise<ResumenAdmin>;
  usuarios(): Promise<UsuarioAdmin[]>;
  paginaUsuarios(filtros: FiltrosUsuarios): Promise<PaginaUsuarios>;
  usuario(id: number): Promise<DetalleUsuarioAdmin>;
  editarUsuario(id: number, datos: EditarUsuarioAdmin): Promise<DetalleUsuarioAdmin>;
  estadoUsuario(id: number, datos: EstadoUsuarioAdmin): Promise<DetalleUsuarioAdmin>;
  historialUsuario(id: number, pagina: number): Promise<CambioUsuarioAdmin[]>;
  invitarUsuario(datos: InvitacionUsuarioAdmin): Promise<void>;
  categorias(): Promise<CategoriaAdmin[]>;
  crearCategoria(input: GuardarCategoriaInput): Promise<CategoriaAdmin>;
  actualizarCategoria(id: number, input: GuardarCategoriaInput): Promise<CategoriaAdmin>;
  tecnicosPendientes(): Promise<TecnicoPendiente[]>;
}

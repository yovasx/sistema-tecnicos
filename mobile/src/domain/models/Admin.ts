export interface ResumenAdmin {
  totalUsuarios: number;
  clientes: number;
  tecnicos: number;
  administradores: number;
  tecnicosPendientes: number;
  tecnicosAprobados: number;
  categoriasActivas: number;
}

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  tipoCliente: string;
  activo: boolean;
  creadoEn: string;
}

export interface FilaUsuarioAdmin extends UsuarioAdmin { telefono: string | null }
export interface FiltrosUsuarios {
  busqueda: string;
  rol: string;
  perfil: string;
  estado: string;
  pagina: number;
  tamano: number;
}
export interface PaginaUsuarios {
  elementos: FilaUsuarioAdmin[];
  total: number;
  pagina: number;
  tamano: number;
}
export interface DetalleUsuarioAdmin extends UsuarioAdmin {
  apellido: string;
  telefono: string | null;
  razonSocial: string | null;
  nit: string | null;
  revision: number;
  acceso: 'password' | 'google' | 'google_y_password';
  estadoValidacion: string | null;
}
export interface EditarUsuarioAdmin {
  revision: number;
  nombre: string;
  apellido: string;
  telefono: string;
  razonSocial: string;
  nit: string;
  motivo: string;
}
export interface EstadoUsuarioAdmin { revision: number; activo: boolean; motivo: string }
export interface InvitacionUsuarioAdmin {
  email: string; nombre: string; apellido: string; telefono: string; rol: string;
  tipoCliente: string; razonSocial: string; nit: string; passwordAdmin: string;
}
export interface CambioUsuarioAdmin {
  id: number;
  administrador: string;
  accion: string;
  motivo: string;
  antes: Record<string, string | boolean | null>;
  despues: Record<string, string | boolean | null>;
  creadoEn: string;
}

export interface CategoriaAdmin {
  id: number;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  tarifaVisita: number | null;
  tarifaHora: number | null;
  recargoUrgenciaPct: number | null;
  moneda: string | null;
  tarifaVigenteDesde: string | null;
  comisionPct: number | null;
  comisionVigenteDesde: string | null;
}

/** Escritura atómica del catálogo: una sola llamada guarda los tres conceptos. */
export interface GuardarCategoriaInput {
  nombre: string;
  descripcion: string;
  activa: boolean;
  tarifaVisita: number;
  tarifaHora: number | null;
  recargoUrgenciaPct: number;
  moneda: string;
  comisionPct: number;
}

export interface TecnicoPendiente {
  usuarioId: number;
  nombre: string;
  email: string;
  estadoValidacion: string;
  disponibilidad: string;
  certificacionesUrl: string | null;
}

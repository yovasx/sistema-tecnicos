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

export interface CategoriaAdmin {
  id: number;
  nombre: string;
  descripcion: string;
  activa: boolean;
  tarifaVisita: number | null;
  tarifaHora: number | null;
  recargoUrgenciaPct: number | null;
  moneda: string | null;
  comisionPct: number | null;
}

export interface TecnicoPendiente {
  usuarioId: number;
  nombre: string;
  email: string;
  estadoValidacion: string;
  disponibilidad: string;
  certificacionesUrl: string | null;
}

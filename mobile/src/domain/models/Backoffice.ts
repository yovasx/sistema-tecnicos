/** Contratos del backoffice operativo: solo datos reales de la API. */
export interface PaginaAdmin<T> {
  elementos: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface Disputa {
  id: number;
  orden: number;
  categoria: string;
  estado: 'abierta' | 'en_revision' | 'resuelta';
  motivo: string;
  resolucion: string | null;
  abiertaPor: string | null;
  contraUsuario: string | null;
  administrador: string | null;
  abiertaEn: string;
  resueltaEn: string | null;
}

export interface Auditoria {
  id: number;
  origen: string;
  sujeto: string | null;
  sujetoId: number | null;
  actor: string | null;
  actorId: number | null;
  accion: string;
  motivo: string | null;
  detalle: Record<string, unknown>;
  creadoEn: string;
}

export interface MensajeModerado {
  id: number;
  orden: number;
  categoria: string;
  emisor: string | null;
  receptor: string | null;
  contenido: string;
  revisado: boolean;
  decision: 'sin_accion' | 'advertencia' | null;
  nota: string | null;
  enviadoEn: string;
  revisadoEn: string | null;
}

export interface NotificacionSistema {
  id: number;
  usuarioId: number;
  usuario: string | null;
  orden: number | null;
  tipo: string;
  mensaje: string;
  leido: boolean;
  enviadoEn: string;
}

export interface LiquidacionAdmin {
  id: number;
  orden: number;
  tecnico: string | null;
  bruto: number;
  comisionPct: number;
  comision: number;
  neto: number;
  estado: string;
  creadaEn: string;
  liquidadaEn: string | null;
}

export interface PuntoActivo {
  orden: number;
  categoria: string;
  estado: string;
  urgencia: boolean;
  tecnico: string | null;
  latitudCliente: number;
  longitudCliente: number;
  latitudTecnico: number | null;
  longitudTecnico: number | null;
  posicionEn: string | null;
  creadoEn: string;
}

export interface ResumenOperativo {
  ofertasPendientes: number;
  solicitudesSinTecnico: number;
  tecnicosDisponibles: number;
  disputasAbiertas: number;
  mensajesPorRevisar: number;
}

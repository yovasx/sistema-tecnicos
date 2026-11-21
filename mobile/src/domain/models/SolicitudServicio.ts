export type EstadoServicio =
  | 'solicitado'
  | 'en_camino'
  | 'en_diagnostico'
  | 'en_reparacion'
  | 'finalizado'
  | 'cancelado';

/** Archivo elegido por el cliente; en web viaja como Blob, en nativo como URI. */
export interface EvidenciaServicio {
  nombre: string;
  uri: string;
  tipo: string;
  tamano?: number;
  contenidoWeb?: Blob;
}

/** Categoría activa con su tarifa publicada; el id solo viaja a clientes autenticados. */
export interface CategoriaSolicitud {
  id: number;
  nombre: string;
  descripcion: string | null;
  tarifaVisita: number | null;
  tarifaHora: number | null;
  moneda: string | null;
}

export interface CrearSolicitud {
  clave: string;
  categoria: number;
  descripcion: string;
  latitud: number;
  longitud: number;
  referencia: string;
  urgencia: boolean;
  evidencia?: EvidenciaServicio;
}

export interface ResultadoSolicitud {
  id: number;
  estado: EstadoServicio;
  creada: boolean;
}

export interface FilaServicio {
  id: number;
  categoriaId: number;
  categoria: string;
  estado: EstadoServicio;
  urgencia: boolean;
  creadoEn: string;
}

export interface PaginaServicios {
  elementos: FilaServicio[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface DetalleServicio extends FilaServicio {
  miCalificacion: number | null;
  descripcion: string;
  referencia: string;
  latitud: number;
  longitud: number;
  evidenciaDisponible: boolean;
  evidenciaExtension: string | null;
  asignadoEn: string | null;
  llegadaEstimadaEn: string | null;
  llegadaEn: string | null;
  finalizadoEn: string | null;
  tecnico: string | null;
  motivoCancelacion: string | null;
  canceladoEn: string | null;
}

export type EstadoOrdenAdmin = 'solicitado' | 'en_camino' | 'en_diagnostico' | 'en_reparacion' | 'finalizado' | 'cancelado';
export interface PaginaOrdenes<T> { elementos: T[]; total: number; pagina: number; tamano: number }
export interface CategoriaOrden { id: number; nombre: string }
export interface PersonaOrden { id: number | null; nombre: string; activo: boolean; eliminada: boolean }
export interface ContactoOrden { persona: PersonaOrden; email: string | null; telefono: string | null }
export interface FilaOrdenAdmin {
  id: number; categoria: CategoriaOrden; cliente: PersonaOrden | null; tecnico: PersonaOrden | null;
  estado: EstadoOrdenAdmin; tarifaUrgencia: boolean; creadoEn: string;
}
export interface DetalleOrdenAdmin {
  id: number; categoria: CategoriaOrden; cliente: ContactoOrden | null; tecnico: ContactoOrden | null;
  estado: EstadoOrdenAdmin; tarifaUrgencia: boolean; descripcionFalla: string;
  direccionReferencia: string | null; ubicacion: { latitud: number; longitud: number };
  creadoEn: string; asignadoEn: string | null; llegadaEstimadaEn: string | null;
  llegadaEn: string | null; finalizadoEn: string | null; actualizadoEn: string;
  cancelacion: { motivo: string | null; autor: PersonaOrden | null; canceladoEn: string | null } | null;
}
export interface TransicionOrdenAdmin {
  id: number; estadoAnterior: EstadoOrdenAdmin | null; estadoNuevo: EstadoOrdenAdmin;
  autor: PersonaOrden | null; observacion: string | null; registradoEn: string;
}
export interface FiltrosOrdenesAdmin {
  busqueda: string; estado: EstadoOrdenAdmin | 'todos'; categoria?: number;
  asignacion: 'todos' | 'asignada' | 'sin_asignar'; desde: string; hasta: string;
  pagina: number; tamano: number;
}

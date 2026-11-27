import { EvidenciaServicio } from './SolicitudServicio';

export interface EventoAtencion { id: number; accion: string; motivo: string; actor: string | null; creadoEn: string }
export interface Atencion {
  orden: number; revision: number; estado: string;
  busqueda: 'buscando' | 'sin_disponibilidad' | 'asignada' | 'cancelada' | null;
  busquedaHasta: string | null; intento: number; pausaMotivo: string | null; reanudarEn: string | null;
  incidencia: string | null; llegadaVerificadaEn: string | null; trabajoRealizado: string | null;
  entregadoEn: string | null; conformidad: 'pendiente' | 'conforme' | 'observado' | 'resuelto_coordinacion' | null;
  respuestaCliente: string | null; proximoMantenimiento: string | null; evidenciaDisponible: boolean;
  equipo: string | null; sucursal: string | null; eventos: EventoAtencion[];
}
export interface Equipo {
  id: number; revision: number; sucursal: number | null; nombre: string;
  marca: string | null; modelo: string | null; identificador: string | null; activo: boolean;
}
export interface Sucursal { id: number; revision: number; nombre: string; referencia: string; activa: boolean }
export interface HistorialEquipo {
  orden: number; categoria: string; estado: string; trabajo: string | null; conformidad: string | null;
  proximoMantenimiento: string | null; creadoEn: string;
}
export interface PanelCoordinacion {
  desde: string; hasta: string;
  indicadores: {
    creadas: number; asignadas: number; sinAsignacion: number; finalizadas: number; canceladas: number;
    minutosAsignacion: number | null; minutosLlegada: number | null; llegadas: number;
    cotizacionesRespondidas: number; cotizacionesAceptadas: number; disputas: number; cerradas: number;
  };
  pendientes: { orden: number; categoria: string; estado: string; motivo: string; creadoEn: string }[];
}
export interface Candidato {
  tecnico: number; nombre: string; especialidad: string; cobertura: boolean; disponible: boolean;
  sinServicio: boolean; distanciaMetros: number | null; reputacion: number; ultimaAsignacion: string | null;
}
export interface EntregaTrabajo { revision: number; trabajo: string; mantenimiento?: string; evidencia: EvidenciaServicio }

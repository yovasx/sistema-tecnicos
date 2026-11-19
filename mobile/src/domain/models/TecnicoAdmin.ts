import { DetalleUsuarioAdmin } from './Admin';
import { EstadoExpediente, Expediente } from './Expediente';

export interface FilaTecnicoAdmin {
  id: number; nombre: string; email: string; activo: boolean;
  estadoValidacion: string; estadoExpediente: EstadoExpediente;
  disponibilidad: Expediente['disponibilidad']; especialidades: string[];
  expedienteRequerido: boolean; enviadoEn: string | null;
}
export interface FiltrosTecnicos {
  busqueda: string; cuenta: string; expediente: string; disponibilidad: string;
  categoria?: number; pagina: number; tamano: number;
}
export interface PaginaTecnicos {
  elementos: FilaTecnicoAdmin[]; total: number; pagina: number; tamano: number;
}
export interface DetalleTecnicoAdmin {
  cuenta: DetalleUsuarioAdmin; expediente: Expediente; expedienteRequerido: boolean;
  aprobadoEn: string | null; aprobadoPor: string | null;
}
export interface RevisionTecnicoAdmin {
  id: number; revisor: string; decision: EstadoExpediente;
  observaciones: Record<string, string>; creadoEn: string;
}

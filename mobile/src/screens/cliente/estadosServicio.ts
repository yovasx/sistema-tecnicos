import { EstadoServicio } from '../../domain/models/SolicitudServicio';
import { TonoChip } from '../../ui/Chip';

const ESTADOS: Record<EstadoServicio, { texto: string; tono: TonoChip }> = {
  solicitado: { texto: 'Solicitado', tono: 'marca' },
  en_camino: { texto: 'Técnico en camino', tono: 'marca' },
  en_diagnostico: { texto: 'En diagnóstico', tono: 'advertencia' },
  en_reparacion: { texto: 'En reparación', tono: 'advertencia' },
  finalizado: { texto: 'Finalizado', tono: 'exito' },
  cancelado: { texto: 'Cancelado', tono: 'neutro' },
};

/** Etiqueta y tono de cada estado de la orden; nunca se inventan estados nuevos. */
export function estadoServicio(estado: EstadoServicio) {
  return ESTADOS[estado] ?? { texto: estado, tono: 'neutro' as TonoChip };
}

import { View } from 'react-native';
import { EstadoOrdenAdmin, PersonaOrden } from '../../../domain/models/OrdenAdmin';
import { Chip, TonoChip } from '../../../ui/Chip';
import { Texto } from '../../../ui/Texto';

export const estadosOrden: Record<EstadoOrdenAdmin, string> = {
  solicitado: 'Solicitado', en_camino: 'En camino', en_diagnostico: 'En diagnóstico',
  en_reparacion: 'En reparación', finalizado: 'Finalizado', cancelado: 'Cancelado',
};
const tonos: Record<EstadoOrdenAdmin, TonoChip> = {
  solicitado: 'advertencia', en_camino: 'marca', en_diagnostico: 'marca',
  en_reparacion: 'marca', finalizado: 'exito', cancelado: 'neutro',
};
export function EstadoOrden({ estado }: { estado: EstadoOrdenAdmin }) {
  return <Chip texto={estadosOrden[estado]} tono={tonos[estado]} />;
}
export function PersonaResumenOrden({ persona, sinDato = 'Cuenta no disponible' }: {
  persona: PersonaOrden | null; sinDato?: string;
}) {
  return <View style={{ gap: 4 }}>
    <Texto variante="etiqueta">{persona?.nombre ?? sinDato}</Texto>
    {persona && !persona.activo ? <Texto variante="caption">{persona.eliminada ? 'Identidad no disponible' : 'Cuenta inactiva'}</Texto> : null}
  </View>;
}
export function fechaOrden(valor: string | null): string {
  return valor ? new Date(valor).toLocaleString('es-BO', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/La_Paz',
  }) : 'Sin registro';
}
export const errorOrden = (e: unknown) => e instanceof Error ? e.message : 'No pudimos completar la consulta de órdenes.';

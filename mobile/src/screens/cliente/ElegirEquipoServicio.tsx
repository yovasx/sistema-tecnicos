import { gestionLocalRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { Texto } from '../../ui/Texto';
import { View } from 'react-native';

export function ElegirEquipoServicio({ equipo, onElegir, bloqueado }: {
  equipo?: number; onElegir: (id: number | undefined) => void; bloqueado: boolean;
}) {
  const c = useConsulta(() => gestionLocalRepository.equipos());
  if (c.error) return <Texto>No pudimos cargar los equipos. Puedes continuar sin vincular uno.</Texto>;
  if (!c.datos?.length) return null;
  return <View style={{ gap: 8 }}><FiltroAdmin etiqueta="Equipo que necesita atención (opcional)" valor={String(equipo ?? '')}
    deshabilitado={bloqueado} opciones={[['', 'Sin equipo registrado'], ...c.datos.filter(e => e.activo).map(e => [String(e.id), e.nombre] as const)]}
    onChange={v => onElegir(v ? Number(v) : undefined)} />
    <Texto variante="caption">El trabajo se añadirá al historial del equipo. Confirma en el mapa el lugar de esta atención.</Texto>
  </View>;
}

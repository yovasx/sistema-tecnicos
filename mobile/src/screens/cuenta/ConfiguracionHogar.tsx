import { useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import { operacionRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

export function ConfiguracionHogar() {
  const c = useConsulta(() => operacionRepository.preferencias());
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  useCambiosSinGuardar(false, ocupado);
  async function cambiar(permitirGps: boolean) {
    if (!c.datos || bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await operacionRepository.guardarPreferencias({ ...c.datos, permitirGps }); c.actualizar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos guardar las preferencias. Actualiza antes de reintentar.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">Configuración y privacidad</Texto>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <Switch accessibilityLabel="Permitir GPS puntual en mis formularios" value={c.datos?.permitirGps ?? false}
        disabled={ocupado || c.cargando || !c.datos || !!error} onValueChange={v => void cambiar(v)} />
      <Texto>Permitir GPS puntual en mis formularios</Texto>
    </View>
    <Texto variante="caption">No activa rastreo. La ubicación solo se consulta al pulsar Usar mi ubicación y aceptar el permiso.
      Siempre puedes ingresar coordenadas o elegir el punto en el mapa.</Texto>
    {error || c.error ? <Aviso tono="peligro">{error || c.error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar preferencias" variante="secundario" deshabilitado={ocupado || c.cargando}
      onPress={() => { setError(''); c.actualizar(); }} />
  </Tarjeta>;
}

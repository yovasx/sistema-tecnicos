import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { operacionRepository } from '../../infrastructure/di';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { fechaHoraBolivia } from '../../ui/formato';
import { useConsulta } from '../useConsulta';

/** Bandeja real de la cuenta; no aparenta tener push ni correo operativo. */
export function NotificacionesCliente() {
  const [pagina, setPagina] = useState(0);
  const consulta = useConsulta(() => operacionRepository.notificaciones(pagina), [pagina]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  async function leer(id: number) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await operacionRepository.leer(id); consulta.actualizar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos marcar la notificación.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <MarcoContenido>
    <Encabezado titulo="Notificaciones" subtitulo="Novedades reales de tus servicios dentro de Fixly." />
    <Texto variante="caption">Esta bandeja no activa notificaciones push ni mensajes por correo.</Texto>
    {consulta.error || error ? <Aviso tono="peligro">{consulta.error || error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar notificaciones" variante="secundario" deshabilitado={ocupado || consulta.cargando} onPress={consulta.actualizar} />
    {consulta.cargando ? <ActivityIndicator /> : !consulta.datos?.elementos.length && !consulta.error ? <Tarjeta><Texto>No tienes notificaciones registradas.</Texto></Tarjeta> : null}
    {!consulta.cargando ? consulta.datos?.elementos.map(n => <Tarjeta key={n.id} style={{ gap: 10 }}>
      <Texto variante="cuerpoFuerte">{n.leido ? 'Leída' : 'Nueva'}{n.orden ? ` · Servicio #${n.orden}` : ''}</Texto>
      <Texto>{n.mensaje}</Texto><Texto variante="caption">{fechaHoraBolivia(n.enviadoEn)}</Texto>
      {!n.leido ? <BotonPrimario titulo="Marcar como leída" variante="secundario" deshabilitado={ocupado} onPress={() => void leer(n.id)} /> : null}
    </Tarjeta>) : null}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <BotonPrimario titulo="Anterior" variante="secundario" deshabilitado={pagina === 0 || consulta.cargando || ocupado} onPress={() => setPagina(p => p - 1)} />
      <BotonPrimario titulo="Siguiente" variante="secundario" deshabilitado={!consulta.datos || (pagina + 1) * 20 >= consulta.datos.total || consulta.cargando || ocupado}
        onPress={() => setPagina(p => p + 1)} />
    </View>
  </MarcoContenido>;
}

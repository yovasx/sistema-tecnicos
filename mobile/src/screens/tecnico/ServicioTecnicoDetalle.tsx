import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { operacionRepository } from '../../infrastructure/di';
import { useSeguimientoGps } from '../../session/SeguimientoGpsProvider';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Mapa } from '../../ui/mapa/Mapa';
import { fechaHoraBolivia } from '../../ui/formato';
import { OperacionDelServicio } from '../servicios/OperacionDelServicio';
import { CalificarServicio } from '../cliente/CalificarServicio';
import { EstadoServicio } from '../../domain/models/SolicitudServicio';
import { estadoServicio } from '../cliente/estadosServicio';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

export function ServicioTecnicoDetalle({ id, onVolver }: { id: number; onVolver: () => void }) {
  const c = useConsulta(async () => {
    const [detalle, cotizaciones] = await Promise.all([operacionRepository.detalle(id), operacionRepository.cotizaciones(id, true)]);
    return { detalle, cotizaciones };
  }, [id]);
  const gps = useSeguimientoGps();
  const [mapa, setMapa] = useState(false);
  const [confirmarGps, setConfirmarGps] = useState<'visible' | 'segundo' | null>(null);
  const [accion, setAccion] = useState<'llegada' | 'reparacion' | 'finalizar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [edicionOperacion, setEdicionOperacion] = useState(false);
  const [edicionCalificacion, setEdicionCalificacion] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  const bloqueado = ocupado || gps.ocupado || edicionOperacion || edicionCalificacion || !!accion || !!confirmarGps;
  useCambiosSinGuardar(edicionOperacion || edicionCalificacion || !!accion || !!confirmarGps, ocupado || gps.ocupado);
  async function avanzar() {
    if (!accion || bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      await operacionRepository.avanzar(id, accion);
      if (gps.sesion?.orden === id) await gps.detener();
      setAccion(null); c.actualizar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos avanzar el servicio.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  const d = c.datos?.detalle;
  const cotizaciones = c.datos?.cotizaciones ?? [];
  const autorizada = cotizaciones.some(q => q.estado === 'aceptada') && !cotizaciones.some(q => q.estado === 'enviada');
  const etiquetas = { llegada: 'Confirmar llegada e iniciar diagnóstico', reparacion: 'Iniciar reparación autorizada', finalizar: 'Finalizar servicio' };
  return <MarcoContenido>
    <BotonPrimario titulo="Volver a servicios" variante="secundario" deshabilitado={bloqueado} onPress={onVolver} />
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar servicio" variante="secundario" deshabilitado={bloqueado || c.cargando} onPress={c.actualizar} />
    {c.cargando ? <ActivityIndicator /> : null}
    {d ? <>
      <Encabezado titulo={`Servicio #${id}`} subtitulo={`${d.categoria} · ${estadoServicio(d.estado as EstadoServicio).texto}`} />
      <Tarjeta style={{ gap: 12 }}>
        <Texto variante="subtitulo">{d.cliente || 'Cliente no disponible'}</Texto>
        <Texto>{d.descripcion}</Texto><Texto>{d.referencia}</Texto>
        <Texto variante="caption">Información privada del servicio asignado.</Texto>
        <BotonPrimario titulo={mapa ? 'Cerrar mapa del destino' : 'Ver destino en el mapa'} variante="secundario"
          deshabilitado={bloqueado} onPress={() => setMapa(v => !v)} />
        {mapa ? <><Texto variante="caption">Al abrir el mapa consultas un proveedor externo. Azul: destino.</Texto>
          <Mapa destino={{ latitud: d.latitud, longitud: d.longitud }} /></> : null}
      </Tarjeta>
      {d.estado === 'en_camino' ? <Tarjeta style={{ gap: 12 }}>
        <Texto variante="subtitulo">Compartir mi ubicación con el cliente</Texto>
        <Texto>{gps.mensaje || 'El GPS está desactivado. Se requiere tu autorización para este trayecto.'}</Texto>
        {gps.ultimoEnvio ? <Texto variante="caption">Último envío: {fechaHoraBolivia(gps.ultimoEnvio)}</Texto> : null}
        {gps.sesion?.orden === id ? <BotonPrimario titulo="Detener GPS del servicio" variante="secundario"
          onPress={() => void gps.detener()} /> : <>
          <BotonPrimario titulo="Activar GPS mientras la app esté visible" deshabilitado={bloqueado}
            onPress={() => setConfirmarGps('visible')} />
          {Platform.OS !== 'web' && process.env.EXPO_PUBLIC_GPS_SEGUNDO_PLANO === 'true' ?
            <BotonPrimario titulo="Activar GPS también en segundo plano" variante="secundario" deshabilitado={bloqueado}
              onPress={() => setConfirmarGps('segundo')} /> : null}
        </>}
        {confirmarGps ? <>
          <Aviso tono="advertencia">Compartirás tu ubicación precisa solo con el cliente de este servicio mientras estés en camino.
            Puedes detenerla en cualquier momento. {confirmarGps === 'segundo'
              ? 'Se solicitará permiso adicional; el sistema puede interrumpir el seguimiento y consumir más batería.'
              : 'Se detiene al ocultar o minimizar la app. En web se necesita HTTPS o localhost.'}</Aviso>
          <BotonPrimario titulo="Confirmar y solicitar permiso GPS" cargando={gps.ocupado} onPress={() => {
            const segundo = confirmarGps === 'segundo'; setConfirmarGps(null); void gps.iniciar(id, segundo);
          }} />
          <BotonPrimario titulo="No compartir mi ubicación" variante="secundario" deshabilitado={gps.ocupado}
            onPress={() => setConfirmarGps(null)} />
        </> : null}
      </Tarjeta> : null}
      {(['en_camino', 'en_diagnostico', 'en_reparacion'] as string[]).includes(d.estado) ? <Tarjeta style={{ gap: 12 }}>
        <Texto variante="subtitulo">Atención del servicio</Texto>
        {!autorizada && d.estado !== 'en_camino' ? <Aviso>El cliente debe aceptar una cotización vigente antes de iniciar o finalizar la reparación.
          Actualiza el servicio después de su respuesta.</Aviso> : null}
        {d.estado === 'en_camino' ? <BotonPrimario titulo={etiquetas.llegada} deshabilitado={bloqueado || c.cargando} onPress={() => setAccion('llegada')} /> : null}
        {d.estado === 'en_diagnostico' ? <BotonPrimario titulo={etiquetas.reparacion} deshabilitado={bloqueado || c.cargando || !autorizada} onPress={() => setAccion('reparacion')} /> : null}
        {d.estado === 'en_reparacion' ? <BotonPrimario titulo={etiquetas.finalizar} deshabilitado={bloqueado || c.cargando || !autorizada} onPress={() => setAccion('finalizar')} /> : null}
        {accion ? <>
          <Aviso tono="advertencia">Confirma: {etiquetas[accion]}. Esta acción quedará registrada.
            Finalizar el servicio no registra ni confirma un pago.</Aviso>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <BotonPrimario titulo="Confirmar acción del servicio" cargando={ocupado} onPress={() => void avanzar()} />
            <BotonPrimario titulo="Cancelar acción" variante="secundario" deshabilitado={ocupado} onPress={() => setAccion(null)} />
          </View>
        </> : null}
      </Tarjeta> : null}
      <OperacionDelServicio orden={id} tecnico estado={d.estado} onCambio={c.actualizar}
        actualizacion={cotizaciones.map(q => `${q.id}:${q.estado}`).join('|')}
        onEdicion={setEdicionOperacion} bloqueado={edicionCalificacion || !!accion || !!confirmarGps || ocupado || gps.ocupado} />
      {d.estado === 'finalizado' ? <CalificarServicio orden={id} actual={d.miCalificacion} tecnico
        onGuardada={c.actualizar} onEdicion={setEdicionCalificacion} bloqueado={edicionOperacion} /> : null}
    </> : null}
  </MarcoContenido>;
}

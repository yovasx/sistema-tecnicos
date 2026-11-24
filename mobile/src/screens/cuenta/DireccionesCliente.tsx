import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';
import { Direccion } from '../../domain/models/Hogar';
import { hogarRepository, operacionRepository } from '../../infrastructure/di';
import { ubicacionActual } from '../../infrastructure/ubicacion/ubicacionActual';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { Mapa } from '../../ui/mapa/Mapa';

const fila = { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as const;
export function DireccionesCliente({ onEdicion }: { onEdicion?: (activa: boolean) => void }) {
  const [lista, setLista] = useState<Direccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [editar, setEditar] = useState<Direccion | 'nueva' | null>(null);
  const [quitar, setQuitar] = useState<number | null>(null);
  const bloqueo = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    onEdicion?.(editar !== null || ocupado);
    return () => onEdicion?.(false);
  }, [editar, ocupado, onEdicion]);
  useEffect(() => {
    let vigente = true; setCargando(true);
    hogarRepository.direcciones().then(d => { if (vigente) { setLista(d); setError(''); } })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No pudimos cargar las direcciones.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [intento]);
  async function eliminar(id: number) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true);
    try { await hogarRepository.quitarDireccion(id); setQuitar(null); setIntento(n => n + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos quitar la dirección.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 16 }}>
    <Texto variante="subtitulo">Mis direcciones</Texto>
    <Texto variante="caption">Guarda hasta 10 lugares. Cambiarlos no modifica tus solicitudes anteriores.</Texto>
    {error ? <><Aviso tono="peligro">{error}</Aviso><BotonPrimario titulo="Reintentar direcciones"
      variante="secundario" onPress={() => setIntento(n => n + 1)} /></> : null}
    {cargando ? <ActivityIndicator /> : null}
    {editar ? <FormularioDireccion key={editar === 'nueva' ? 'nueva' : editar.id}
      inicial={editar === 'nueva' ? null : editar} onCerrar={() => setEditar(null)}
      onGuardada={() => { setEditar(null); setIntento(n => n + 1); }} /> : <>
      {!cargando && !error && !lista.length ? <Texto>Todavía no guardaste una dirección.</Texto> : null}
      {lista.map(d => <View key={d.id} style={{ gap: 8 }}>
        <Texto variante="cuerpoFuerte">{d.etiqueta}{d.predeterminada ? ' · Predeterminada' : ''}</Texto>
        <Texto>{d.referencia}</Texto>
        <View style={fila}>
          <BotonPrimario titulo={`Editar ${d.etiqueta}`} variante="secundario" deshabilitado={ocupado}
            onPress={() => { setQuitar(null); setEditar(d); }} />
          <BotonPrimario titulo={quitar === d.id ? 'Confirmar quitar dirección' : `Quitar ${d.etiqueta}`}
            variante="secundario" deshabilitado={ocupado}
            onPress={() => quitar === d.id ? void eliminar(d.id) : setQuitar(d.id)} />
          {quitar === d.id ? <BotonPrimario titulo="Conservar dirección" variante="secundario"
            deshabilitado={ocupado} onPress={() => setQuitar(null)} /> : null}
        </View>
      </View>)}
      <BotonPrimario titulo="Agregar dirección" deshabilitado={cargando || ocupado || lista.length >= 10}
        onPress={() => setEditar('nueva')} />
    </>}
  </Tarjeta>;
}

function FormularioDireccion({ inicial, onCerrar, onGuardada }: {
  inicial: Direccion | null; onCerrar: () => void; onGuardada: () => void;
}) {
  const [etiqueta, setEtiqueta] = useState(inicial?.etiqueta ?? '');
  const [referencia, setReferencia] = useState(inicial?.referencia ?? '');
  const [latitud, setLatitud] = useState(inicial ? String(inicial.latitud) : '');
  const [longitud, setLongitud] = useState(inicial ? String(inicial.longitud) : '');
  const [predeterminada, setPredeterminada] = useState(inicial?.predeterminada ?? false);
  const [mapa, setMapa] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [gps, setGps] = useState(false);
  const [error, setError] = useState('');
  const [salida, setSalida] = useState(false);
  const bloqueo = useRef(false);
  const sucio = etiqueta !== (inicial?.etiqueta ?? '') || referencia !== (inicial?.referencia ?? '')
    || latitud !== (inicial ? String(inicial.latitud) : '') || longitud !== (inicial ? String(inicial.longitud) : '')
    || predeterminada !== (inicial?.predeterminada ?? false);
  useCambiosSinGuardar(sucio, ocupado);
  const lat = Number(latitud), lng = Number(longitud);
  const valido = latitud.trim() !== '' && longitud.trim() !== ''
    && Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
  async function guardar() {
    if (bloqueo.current) return;
    if (!valido || !etiqueta.trim() || referencia.trim().length < 5) {
      setError('Completa la etiqueta, una referencia de al menos 5 caracteres y coordenadas válidas.'); return;
    }
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      await hogarRepository.guardarDireccion(inicial?.id ?? null,
        { etiqueta, referencia, latitud: lat, longitud: lng, predeterminada });
      onGuardada();
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos guardar la dirección.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  async function usarGps() {
    if (gps) return;
    setGps(true); setError('');
    try {
      if (!(await operacionRepository.preferencias()).permitirGps)
        throw new Error('El GPS puntual está desactivado en Configuración y privacidad. Puedes ingresar las coordenadas o usar el mapa.');
      const p = await ubicacionActual(); setLatitud(String(p.lat)); setLongitud(String(p.lng));
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos obtener tu ubicación.'); }
    finally { setGps(false); }
  }
  return <View style={{ gap: 12 }}>
    <CampoTexto etiqueta="Etiqueta (por ejemplo, Casa)" value={etiqueta} onChangeText={setEtiqueta} maxLength={40} editable={!ocupado} />
    <CampoTexto etiqueta="Dirección y referencia" value={referencia} onChangeText={setReferencia} maxLength={300} editable={!ocupado} />
    <BotonPrimario titulo="Usar mi ubicación" variante="secundario" cargando={gps} deshabilitado={ocupado}
      onPress={() => void usarGps()} />
    <CampoTexto etiqueta="Latitud" value={latitud} onChangeText={setLatitud} editable={!ocupado} keyboardType="numbers-and-punctuation" />
    <CampoTexto etiqueta="Longitud" value={longitud} onChangeText={setLongitud} editable={!ocupado} keyboardType="numbers-and-punctuation" />
    <Texto variante="caption">Puedes ingresar las coordenadas manualmente. El mapa solo se carga si lo abres y consulta servicios de terceros.</Texto>
    <BotonPrimario titulo={mapa ? 'Cerrar mapa' : 'Elegir punto en el mapa'} variante="secundario"
      deshabilitado={ocupado} onPress={() => setMapa(v => !v)} />
    {mapa && !ocupado ? <Mapa destino={valido ? { latitud: lat, longitud: lng } : { latitud: -16.5, longitud: -68.13 }}
      onSeleccionar={p => { setLatitud(p.latitud.toFixed(6)); setLongitud(p.longitud.toFixed(6)); }} /> : null}
    <View style={fila}><Texto>Dirección predeterminada</Texto>
      <Switch accessibilityLabel="Dirección predeterminada" value={predeterminada} onValueChange={setPredeterminada} disabled={ocupado} /></View>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {salida ? <Aviso tono="advertencia">Confirma si quieres descartar los cambios.</Aviso> : null}
    <View style={fila}>
      <BotonPrimario titulo="Guardar dirección" cargando={ocupado} deshabilitado={gps} onPress={() => void guardar()} />
      <BotonPrimario titulo={salida ? 'Descartar cambios' : 'Cancelar'} variante="secundario" deshabilitado={ocupado}
        onPress={() => sucio && !salida ? setSalida(true) : onCerrar()} />
      {salida ? <BotonPrimario titulo="Seguir editando" variante="secundario" onPress={() => setSalida(false)} /> : null}
    </View>
  </View>;
}

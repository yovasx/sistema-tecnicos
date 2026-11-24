import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Cobertura, ZonaPropuesta } from '../../domain/models/Cobertura';
import { NuevaCobertura } from '../../domain/repositories/CoberturaRepository';
import { coberturaRepository as repo } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Mapa } from '../../ui/mapa/Mapa';
import { fechaHoraBolivia } from '../../ui/formato';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { areasCobertura, centroCobertura, MapaCobertura } from './MapaCobertura';

export const estadosPropuesta = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', retirada: 'Retirada' };
const fila = { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as const;
export function CoberturaTecnico() {
  const [pagina, setPagina] = useState(0);
  const c = useConsulta(() => repo.propia(pagina), [pagina]);
  const [editar, setEditar] = useState(false);
  const [retirar, setRetirar] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  async function confirmarRetiro() {
    if (bloqueo.current || retirar === null) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await repo.retirar(retirar); setRetirar(null); c.actualizar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos retirar la propuesta.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <MarcoContenido>
    <Encabezado titulo="Mi cobertura" subtitulo="Especialidades, áreas vigentes y propuestas revisadas por administración." />
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    {!editar ? <BotonPrimario titulo="Actualizar cobertura" variante="secundario" deshabilitado={ocupado || c.cargando} onPress={c.actualizar} /> : null}
    {c.cargando ? <ActivityIndicator /> : null}
    {c.datos && !c.error ? <>
      {editar ? <FormularioCobertura datos={c.datos} onCerrar={() => setEditar(false)}
        onGuardada={() => { setEditar(false); setPagina(0); c.actualizar(); }} /> : <>
        <Tarjeta style={{ gap: 12 }}>
          <Texto variante="subtitulo">Especialidades y zonas vigentes</Texto>
          <Texto>{c.datos.especialidades.join(' · ') || 'Sin especialidades registradas'}</Texto>
          <Texto variante="caption">La especialidad no se modifica con una propuesta geográfica.</Texto>
          {c.datos.zonas.map(z => <Texto key={z.id}>{z.nombre || 'Zona sin nombre'} · {z.radioMetros == null
            ? 'Polígono conservado, sin radio declarado' : `Radio declarado: ${z.radioMetros} m`}</Texto>)}
          {!c.datos.zonas.length ? <Aviso>No tienes cobertura vigente.</Aviso> : null}
          <MapaCobertura datos={c.datos} comprobar />
        </Tarjeta>
        <Tarjeta style={{ gap: 12 }}>
          <Texto variante="subtitulo">Proponer nueva cobertura</Texto>
          <Texto>Propón de una a cinco zonas por punto y radio. Debes estar fuera de servicio y sin órdenes abiertas al enviar
            y al aprobar. Tu cobertura vigente no cambia hasta la aprobación.</Texto>
          <Aviso tono="advertencia">La propuesta reemplazará todas las zonas vigentes si se aprueba. Los polígonos anteriores se conservan en el historial de auditoría.</Aviso>
          <BotonPrimario titulo="Preparar propuesta de cobertura" deshabilitado={ocupado || c.cargando
            || c.datos.solicitudes.some(s => s.estado === 'pendiente')} onPress={() => setEditar(true)} />
        </Tarjeta>
        <Texto variante="subtitulo">Historial de propuestas</Texto>
        {c.datos.solicitudes.map(s => <Tarjeta key={s.id} style={{ gap: 12 }}>
          <Texto variante="cuerpoFuerte">Propuesta #{s.id} · {estadosPropuesta[s.estado]}</Texto>
          <Texto variante="caption">{fechaHoraBolivia(s.creadaEn)}</Texto>
          <Texto>{s.motivo}</Texto>
          {s.zonas.map((z, i) => <Texto key={i}>{z.nombre}: {z.latitud}, {z.longitud} · {z.radioMetros} m</Texto>)}
          {s.motivoRevision ? <Aviso>Decisión: {s.motivoRevision}</Aviso> : null}
          {s.estado === 'pendiente' ? <>
            <MapaCobertura datos={c.datos!} propuestas={s.zonas} />
            <BotonPrimario titulo={retirar === s.id ? 'Confirmar retiro de propuesta' : 'Retirar propuesta'}
              variante="secundario" deshabilitado={ocupado} onPress={() => retirar === s.id ? void confirmarRetiro() : setRetirar(s.id)} />
            {retirar === s.id ? <BotonPrimario titulo="Conservar propuesta" variante="secundario" deshabilitado={ocupado} onPress={() => setRetirar(null)} /> : null}
          </> : null}
        </Tarjeta>)}
        {!c.datos.totalSolicitudes ? <Texto>Todavía no enviaste propuestas.</Texto> : null}
        <View style={fila}>
          <BotonPrimario titulo="Propuestas anteriores" variante="secundario" deshabilitado={ocupado || c.cargando || pagina === 0} onPress={() => setPagina(p => p - 1)} />
          <Texto>Página {pagina + 1}</Texto>
          <BotonPrimario titulo="Más propuestas" variante="secundario" deshabilitado={ocupado || c.cargando || (pagina + 1) * 20 >= c.datos.totalSolicitudes} onPress={() => setPagina(p => p + 1)} />
        </View>
      </>}
    </> : null}
  </MarcoContenido>;
}

interface BorradorZona { nombre: string; latitud: string; longitud: string; radio: string }
function zonaValida(z: BorradorZona): ZonaPropuesta | null {
  const lat = Number(z.latitud), lng = Number(z.longitud), radio = Number(z.radio);
  return z.nombre.trim().length >= 2 && z.latitud.trim() !== '' && z.longitud.trim() !== ''
    && Number.isFinite(lat) && Math.abs(lat) <= 85 && Number.isFinite(lng) && Math.abs(lng) <= 180
    && Number.isInteger(radio) && radio >= 100 && radio <= 50000
    ? { nombre: z.nombre.trim(), latitud: lat, longitud: lng, radioMetros: radio } : null;
}
function FormularioCobertura({ datos, onCerrar, onGuardada }: { datos: Cobertura; onCerrar: () => void; onGuardada: () => void }) {
  const [zonas, setZonas] = useState<BorradorZona[]>([{ nombre: '', latitud: '', longitud: '', radio: '3000' }]);
  const [motivo, setMotivo] = useState('');
  const [mapa, setMapa] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [salir, setSalir] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [intento, setIntento] = useState<NuevaCobertura | null>(null);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  useCambiosSinGuardar(true, ocupado);
  const validas = zonas.map(zonaValida).filter((z): z is ZonaPropuesta => z !== null);
  const valido = validas.length === zonas.length && motivo.trim().length >= 5;
  const congelado = ocupado || intento !== null;
  function cambiar(i: number, k: keyof BorradorZona, v: string) {
    if (congelado) return;
    setConfirmar(false); setZonas(t => t.map((z, n) => n === i ? { ...z, [k]: v } : z));
  }
  async function enviar() {
    if (bloqueo.current) return;
    const solicitud = intento ?? { clave: Crypto.randomUUID(), revision: datos.revision, motivo: motivo.trim(), zonas: validas };
    bloqueo.current = true; setOcupado(true); setIntento(solicitud); setError('');
    try { await repo.proponer(solicitud); onGuardada(); }
    catch (e) {
      const incierto = !(e instanceof ErrorApi) || !e.estado || e.estado >= 500;
      if (!incierto) { setIntento(null); setConfirmar(false); }
      setError((e instanceof Error ? e.message : 'No pudimos enviar la propuesta.')
        + (incierto ? ' El resultado es incierto. Reintenta el mismo envío; no se duplicará.' : ' Puedes volver y actualizar la cobertura.'));
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 16 }}>
    <Texto variante="subtitulo">Nueva propuesta: reemplazo completo</Texto>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {zonas.map((z, i) => <View key={i} style={{ gap: 12 }}>
      <Texto variante="cuerpoFuerte">Zona {i + 1}</Texto>
      <CampoTexto etiqueta={`Nombre de zona ${i + 1}`} value={z.nombre} maxLength={100} editable={!congelado} onChangeText={v => cambiar(i, 'nombre', v)} />
      <CampoTexto etiqueta={`Latitud de zona ${i + 1}`} value={z.latitud} editable={!congelado} onChangeText={v => cambiar(i, 'latitud', v)} keyboardType="numbers-and-punctuation" />
      <CampoTexto etiqueta={`Longitud de zona ${i + 1}`} value={z.longitud} editable={!congelado} onChangeText={v => cambiar(i, 'longitud', v)} keyboardType="numbers-and-punctuation" />
      <CampoTexto etiqueta={`Radio en metros de zona ${i + 1}`} value={z.radio} editable={!congelado} onChangeText={v => cambiar(i, 'radio', v)} keyboardType="numeric" />
      <Texto variante="caption">Radio entero: entre 100 y 50000 metros. Puedes escribir coordenadas o elegir un punto en el mapa.</Texto>
      <BotonPrimario titulo={mapa === i ? 'Cerrar selector de punto' : `Elegir punto de zona ${i + 1}`} variante="secundario"
        deshabilitado={congelado} onPress={() => setMapa(mapa === i ? null : i)} />
      {mapa === i ? <Mapa destino={zonaValida(z) ?? centroCobertura(datos)} areas={areasCobertura(datos, validas)}
        etiquetaPunto="Centro propuesto" onSeleccionar={congelado ? undefined : p => {
          cambiar(i, 'latitud', p.latitud.toFixed(6)); cambiar(i, 'longitud', p.longitud.toFixed(6));
        }} /> : null}
      {zonas.length > 1 ? <BotonPrimario titulo={`Quitar zona ${i + 1}`} variante="secundario" deshabilitado={congelado}
        onPress={() => { setZonas(t => t.filter((_, n) => n !== i)); setMapa(null); setConfirmar(false); }} /> : null}
    </View>)}
    <BotonPrimario titulo="Agregar otra zona" variante="secundario" deshabilitado={congelado || zonas.length >= 5}
      onPress={() => { setZonas(t => [...t, { nombre: '', latitud: '', longitud: '', radio: '3000' }]); setConfirmar(false); }} />
    <CampoTexto etiqueta="Motivo de la nueva cobertura" value={motivo} maxLength={500} multiline editable={!congelado}
      onChangeText={v => { setMotivo(v); setConfirmar(false); }} />
    <MapaCobertura datos={datos} propuestas={validas} />
    {!confirmar && !intento ? <BotonPrimario titulo="Revisar propuesta antes de enviar" deshabilitado={!valido || ocupado} onPress={() => setConfirmar(true)} /> : <>
      <Aviso tono="advertencia">Confirma el reemplazo completo de tu cobertura con estas {zonas.length} zonas. No tendrá efecto antes de la aprobación administrativa.</Aviso>
      <BotonPrimario titulo={intento ? 'Reintentar la misma propuesta' : 'Confirmar y enviar propuesta'} cargando={ocupado} onPress={() => void enviar()} />
    </>}
    <BotonPrimario titulo="Cancelar propuesta sin enviar" variante="secundario" deshabilitado={congelado} onPress={() => setSalir(true)} />
    {salir ? <><Aviso tono="advertencia">Se descartarán los datos sin enviar.</Aviso>
      <BotonPrimario titulo="Descartar borrador de cobertura" variante="secundario" deshabilitado={congelado} onPress={onCerrar} />
      <BotonPrimario titulo="Seguir editando cobertura" variante="secundario" onPress={() => setSalir(false)} /></> : null}
  </Tarjeta>;
}

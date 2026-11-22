import { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { Cotizacion, ItemCotizacion } from '../../domain/models/Operacion';
import { operacionRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';
import { useConsulta } from '../useConsulta';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { fechaHoraBolivia, bolivianos } from '../../ui/formato';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

const fila = { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } as const;
const textoError = (e: unknown) => e instanceof Error ? e.message : 'No pudimos completar la operación.';
const incierta = (e: unknown) => !(e instanceof ErrorApi) || !e.estado || e.estado >= 500;
export function OperacionDelServicio({ orden, tecnico, estado, onCambio, onEdicion, bloqueado = false, actualizacion = '' }: {
  orden: number; tecnico: boolean; estado: string; onCambio: () => void; onEdicion: (activa: boolean) => void; bloqueado?: boolean; actualizacion?: string;
}) {
  const [modo, setModo] = useState<'cotizaciones' | 'chat' | null>(null);
  const [editando, setEditando] = useState(false);
  useEffect(() => { onEdicion(editando); return () => onEdicion(false); }, [editando, onEdicion]);
  return <Tarjeta style={{ gap: 16 }}>
    <Texto variante="subtitulo">Comunicación y cotizaciones</Texto>
    <View style={fila}>
      <BotonPrimario titulo={modo === 'cotizaciones' ? 'Cerrar cotizaciones' : 'Ver cotizaciones'}
        variante="secundario" deshabilitado={editando || bloqueado} onPress={() => setModo(m => m === 'cotizaciones' ? null : 'cotizaciones')} />
      <BotonPrimario titulo={modo === 'chat' ? 'Cerrar conversación' : 'Abrir conversación'}
        variante="secundario" deshabilitado={editando || bloqueado} onPress={() => setModo(m => m === 'chat' ? null : 'chat')} />
    </View>
    {modo === 'cotizaciones' ? <Cotizaciones orden={orden} tecnico={tecnico} estado={estado} actualizacion={actualizacion}
      onCambio={onCambio} onEdicion={setEditando} /> : null}
    {modo === 'chat' ? <Conversacion orden={orden} onEdicion={setEditando} /> : null}
  </Tarjeta>;
}

function Cotizaciones({ orden, tecnico, estado, onCambio, onEdicion, actualizacion }: {
  orden: number; tecnico: boolean; estado: string; onCambio: () => void; onEdicion: (v: boolean) => void; actualizacion: string;
}) {
  const c = useConsulta(() => operacionRepository.cotizaciones(orden, tecnico), [orden, tecnico, actualizacion]);
  const [editar, setEditar] = useState(false);
  const [decision, setDecision] = useState<{ cotizacion: Cotizacion; acepta: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  useCambiosSinGuardar(!!decision, ocupado);
  useEffect(() => { if (!editar) onEdicion(!!decision || ocupado); }, [decision, ocupado, editar, onEdicion]);
  async function responder() {
    if (!decision || bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      await operacionRepository.responder(orden, decision.cotizacion.id, decision.acepta, motivo);
      setDecision(null); setMotivo(''); c.actualizar(); onCambio();
    } catch (e) { setError(textoError(e)); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  if (editar) return <EditorCotizacion orden={orden} onEdicion={onEdicion}
      onCerrar={() => { setEditar(false); onEdicion(false); }} onEnviada={() => { setEditar(false); onEdicion(false); c.actualizar(); onCambio(); }} />;
  const pendiente = c.datos?.find(q => q.estado === 'enviada');
  return <View style={{ gap: 14 }}>
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    {c.cargando ? <ActivityIndicator /> : null}
    <BotonPrimario titulo="Actualizar cotizaciones" variante="secundario" deshabilitado={ocupado || !!decision || c.cargando} onPress={c.actualizar} />
    <Texto variante="caption">Últimas 50 versiones enviadas. Una nueva cotización no modifica la versión anterior. Importes en BOB cuando corresponde.</Texto>
    {!c.cargando && !c.error && !c.datos?.length ? <Texto>No hay cotizaciones registradas.</Texto> : null}
    {c.datos?.map(q => <Tarjeta key={q.id} style={{ gap: 10 }}>
      <Texto variante="cuerpoFuerte">Cotización v{q.version} · {q.estado}</Texto>
      <Texto>{q.motivo || 'Sin diagnóstico registrado'}</Texto>
      {q.items.map((i, n) => <Texto key={n}>{i.descripcion} · {i.cantidad} × {i.precioUnitario.toFixed(2)} {q.moneda}</Texto>)}
      <Texto variante="subtitulo">Total: {q.total.toFixed(2)} {q.moneda}</Texto>
      {q.expiraEn ? <Texto variante="caption">Vencimiento: {fechaHoraBolivia(q.expiraEn)}</Texto> : null}
      {!tecnico && pendiente?.id === q.id && q.estado === 'enviada' && ['en_diagnostico', 'en_reparacion'].includes(estado) ? <>
        <View style={fila}>
          <BotonPrimario titulo="Aceptar cotización" deshabilitado={ocupado || !!decision || c.cargando}
            onPress={() => { setError(''); setDecision({ cotizacion: q, acepta: true }); }} />
          <BotonPrimario titulo="Rechazar cotización" variante="secundario" deshabilitado={ocupado || !!decision || c.cargando}
            onPress={() => { setError(''); setDecision({ cotizacion: q, acepta: false }); }} />
        </View>
      </> : null}
    </Tarjeta>)}
    {decision ? <View style={{ gap: 12 }}>
      <Aviso tono="advertencia">Confirma si deseas {decision.acepta ? 'aceptar' : 'rechazar'} la cotización
        v{decision.cotizacion.version} por {decision.cotizacion.total.toFixed(2)} {decision.cotizacion.moneda}.
        Aceptar autoriza el trabajo cotizado, no registra un pago.</Aviso>
      {!decision.acepta ? <CampoTexto etiqueta="Motivo del rechazo (opcional)" value={motivo} onChangeText={setMotivo} maxLength={500} editable={!ocupado} /> : null}
      <View style={fila}><BotonPrimario titulo="Confirmar decisión" cargando={ocupado} onPress={() => void responder()} />
        <BotonPrimario titulo="Cancelar decisión" variante="secundario" deshabilitado={ocupado}
          onPress={() => { setDecision(null); setMotivo(''); }} /></View>
    </View> : null}
    {tecnico && ['en_diagnostico', 'en_reparacion'].includes(estado) ? <BotonPrimario titulo="Preparar cotización"
      deshabilitado={ocupado || c.cargando} onPress={() => setEditar(true)} /> : null}
  </View>;
}

interface Linea { tipo: string; descripcion: string; cantidad: string; precio: string }
const linea = (): Linea => ({ tipo: 'mano_obra', descripcion: '', cantidad: '1', precio: '' });
function EditorCotizacion({ orden, onCerrar, onEnviada, onEdicion }: {
  orden: number; onCerrar: () => void; onEnviada: () => void; onEdicion: (v: boolean) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [items, setItems] = useState<Linea[]>([linea()]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const [salida, setSalida] = useState(false);
  const bloqueo = useRef(false);
  const clave = useRef<string | null>(null);
  const sucio = !!motivo || items.some(i => i.descripcion || i.precio);
  useCambiosSinGuardar(sucio || incierto, ocupado);
  useEffect(() => { onEdicion(true); return () => onEdicion(false); }, [onEdicion]);
  function cambiar(n: number, k: keyof Linea, v: string) {
    setItems(a => a.map((i, j) => j === n ? { ...i, [k]: v } : i));
  }
  async function enviar() {
    if (bloqueo.current) return;
    const dec = /^\d+([.,]\d{1,2})?$/;
    if (motivo.trim().length < 5 || items.some(i => i.descripcion.trim().length < 2 || !dec.test(i.cantidad)
      || Number(i.cantidad.replace(',', '.')) <= 0 || !dec.test(i.precio))) {
      setError('Completa el diagnóstico y cada concepto con cantidad positiva e importe de hasta dos decimales.'); return;
    }
    bloqueo.current = true; setOcupado(true); setError('');
    const datos: ItemCotizacion[] = items.map(i => ({ tipo: i.tipo, descripcion: i.descripcion.trim(),
      cantidad: Number(i.cantidad.replace(',', '.')), precioUnitario: Number(i.precio.replace(',', '.')) }));
    try {
      clave.current ??= Crypto.randomUUID();
      await operacionRepository.cotizar(orden, clave.current, motivo.trim(), datos);
      onEnviada();
    } catch (e) { setError(textoError(e)); setIncierto(incierta(e)); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <View style={{ gap: 14 }}>
    <Texto variante="subtitulo">Diagnóstico y nueva cotización</Texto>
    <CampoTexto etiqueta="Diagnóstico y motivo de esta versión" value={motivo} onChangeText={setMotivo}
      multiline maxLength={1000} editable={!ocupado && !incierto} />
    {items.map((i, n) => <Tarjeta key={n} style={{ gap: 10 }}>
      <Texto variante="cuerpoFuerte">Concepto {n + 1}</Texto>
      <View style={fila}>{[['mano_obra', 'Mano de obra'], ['repuesto', 'Repuesto'], ['visita', 'Visita'],
        ['desplazamiento', 'Desplazamiento'], ['urgencia', 'Urgencia'], ['otro', 'Otro']].map(([v, etiqueta]) =>
        <BotonPrimario key={v} titulo={etiqueta} variante={i.tipo === v ? 'primario' : 'secundario'}
          deshabilitado={ocupado || incierto} onPress={() => cambiar(n, 'tipo', v)} />)}</View>
      <CampoTexto etiqueta={`Descripción del concepto ${n + 1}`} value={i.descripcion} onChangeText={v => cambiar(n, 'descripcion', v)}
        maxLength={200} editable={!ocupado && !incierto} />
      <CampoTexto etiqueta={`Cantidad ${n + 1}`} value={i.cantidad} onChangeText={v => cambiar(n, 'cantidad', v)}
        keyboardType="decimal-pad" editable={!ocupado && !incierto} />
      <CampoTexto etiqueta={`Precio unitario BOB ${n + 1}`} value={i.precio} onChangeText={v => cambiar(n, 'precio', v)}
        keyboardType="decimal-pad" editable={!ocupado && !incierto} />
      {items.length > 1 ? <BotonPrimario titulo={`Quitar concepto ${n + 1}`} variante="secundario"
        deshabilitado={ocupado || incierto} onPress={() => setItems(a => a.filter((_, j) => j !== n))} /> : null}
    </Tarjeta>)}
    <BotonPrimario titulo="Agregar concepto" variante="secundario" deshabilitado={ocupado || incierto || items.length >= 20}
      onPress={() => setItems(a => [...a, linea()])} />
    <Aviso>El servidor calcula el total. Se enviará en BOB y tendrá 30 minutos de vigencia.
      No comiences trabajos no aceptados por el cliente.</Aviso>
    {incierto ? <Aviso tono="advertencia">No se confirmó el envío. Reintenta con esta misma versión; no se generará una cotización duplicada.</Aviso> : null}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {salida ? <Aviso tono="advertencia">Descartar el borrador no elimina una cotización que el servidor ya haya recibido.</Aviso> : null}
    <View style={fila}>
      <BotonPrimario titulo={incierto ? 'Reintentar envío de cotización' : 'Enviar cotización al cliente'} cargando={ocupado} onPress={() => void enviar()} />
      <BotonPrimario titulo={salida ? 'Confirmar descarte' : 'Cancelar cotización'} variante="secundario"
        deshabilitado={ocupado} onPress={() => (sucio || incierto) && !salida ? setSalida(true) : onCerrar()} />
    </View>
  </View>;
}

function Conversacion({ orden, onEdicion }: { orden: number; onEdicion: (v: boolean) => void }) {
  const nav = useContext(NavigationContext);
  const [antes, setAntes] = useState(0);
  const c = useConsulta(() => operacionRepository.mensajes(orden, antes), [orden, antes]);
  const consulta = useRef(c); consulta.current = c;
  const [contenido, setContenido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const [salida, setSalida] = useState(false);
  const [error, setError] = useState('');
  const clave = useRef<string | null>(null);
  const bloqueo = useRef(false);
  useCambiosSinGuardar(!!contenido || incierto, ocupado);
  useEffect(() => { onEdicion(!!contenido || ocupado || incierto); return () => onEdicion(false); }, [contenido, ocupado, incierto, onEdicion]);
  useEffect(() => {
    if (antes) return;
    const t = setInterval(() => {
      if (!consulta.current.cargando && (nav?.isFocused() ?? true) && AppState.currentState === 'active'
        && (Platform.OS !== 'web' || !document.hidden)) consulta.current.actualizar();
    }, 5000);
    return () => clearInterval(t);
  }, [antes, nav]);
  async function enviar() {
    if (bloqueo.current || !contenido.trim()) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      clave.current ??= Crypto.randomUUID();
      await operacionRepository.enviar(orden, clave.current, contenido.trim());
      setContenido(''); setIncierto(false); clave.current = null; setAntes(0); c.actualizar();
    } catch (e) { setError(textoError(e)); setIncierto(incierta(e)); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <View style={{ gap: 12 }}>
    <Texto variante="subtitulo">Conversación privada del servicio</Texto>
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    {c.cargando && !c.datos ? <ActivityIndicator /> : null}
    {c.datos?.mensajes.map(m => <Tarjeta key={m.id} style={{ gap: 6 }}>
      <Texto variante="cuerpoFuerte">{m.tipo === 'sistema' ? 'Actualización del servicio' : m.propio ? 'Tú' : 'Contraparte del servicio'}</Texto>
      <Texto>{m.contenido}</Texto><Texto variante="caption">{fechaHoraBolivia(m.enviadoEn)}</Texto>
      {m.contieneContacto ? <Texto variante="caption">Evita compartir datos personales o de contacto fuera de lo necesario para el servicio.</Texto> : null}
    </Tarjeta>)}
    <View style={fila}>
      {c.datos?.hayAnteriores ? <BotonPrimario titulo="Ver mensajes anteriores" variante="secundario"
        deshabilitado={ocupado || c.cargando} onPress={() => setAntes(c.datos!.mensajes[0].id)} /> : null}
      <BotonPrimario titulo={antes ? 'Volver a mensajes recientes' : 'Actualizar conversación'} variante="secundario"
        deshabilitado={ocupado || c.cargando} onPress={() => { setAntes(0); c.actualizar(); }} />
    </View>
    {c.datos?.abierta || contenido ? <>
      <CampoTexto etiqueta="Mensaje al participante del servicio" value={contenido} onChangeText={setContenido}
        multiline maxLength={2000} editable={!ocupado && !incierto && !!c.datos?.abierta} />
      {incierto ? <Aviso tono="advertencia">No se confirmó el envío. Reintenta el mismo mensaje para evitar duplicados.</Aviso> : null}
      <View style={fila}>
        <BotonPrimario titulo={incierto ? 'Reintentar mensaje' : 'Enviar mensaje'} cargando={ocupado}
          deshabilitado={!contenido.trim() || (!c.datos?.abierta && !incierto)} onPress={() => void enviar()} />
        {contenido ? <BotonPrimario titulo={salida ? 'Confirmar descarte del mensaje' : 'Descartar borrador del mensaje'}
          variante="secundario" deshabilitado={ocupado} onPress={() => {
            if (!salida) { setSalida(true); return; }
            setContenido(''); setIncierto(false); setSalida(false); clave.current = null;
          }} /> : null}
      </View>
    </> : c.datos ? <Texto>La conversación está cerrada. Puedes consultar su historial.</Texto> : null}
  </View>;
}

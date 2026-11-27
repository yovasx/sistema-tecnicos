import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { gestionLocalRepository as repo } from '../../infrastructure/di';
import { EvidenciaServicio } from '../../domain/models/SolicitudServicio';
import { useConsulta } from '../useConsulta';
import { useActualizacionVisible } from '../useActualizacionVisible';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Chip } from '../../ui/Chip';
import { fechaHoraBolivia } from '../../ui/formato';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

const fila = { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } as const;
type Modo = 'cliente' | 'tecnico' | 'coordinacion';
const etiquetas: Record<string, string> = {
  llegada: 'Confirmar encuentro', entrega: 'Registrar trabajo terminado', conforme: 'Confirmar conformidad',
  observar: 'Reportar un problema con la entrega', pausar: 'Pausar por repuestos u otra causa', reanudar: 'Reanudar atención',
  solicitar_cancelacion: 'Solicitar cancelación', cliente_ausente: 'Registrar ausencia del cliente',
  solicitar_coordinacion: 'Pedir ayuda de coordinación', cancelar: 'Cerrar sin reparación / cancelar',
  llegada_justificada: 'Confirmar llegada excepcional', reprogramar: 'Reprogramar continuación',
  cerrar_entrega: 'Resolver cierre de entrega',
};

/** Estado operativo adicional sin inventar pagos ni alterar libremente la máquina de estados. */
export function AtencionLocal({ orden, modo, onCambio, onEdicion, bloqueado = false }: {
  orden: number; modo: Modo; onCambio?: () => void; onEdicion?: (activa: boolean) => void; bloqueado?: boolean;
}) {
  const c = useConsulta(() => repo.atencion(orden), [orden]);
  const [accion, setAccion] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState('');
  const [mantenimiento, setMantenimiento] = useState('');
  const [evidencia, setEvidencia] = useState<EvidenciaServicio | null>(null);
  const [codigo, setCodigo] = useState('');
  const [emitido, setEmitido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  const actualizacion = useRef(onCambio); actualizacion.current = onCambio;
  const previo = useRef<string | null>(null);
  const a = c.datos;
  useCambiosSinGuardar(!!accion, ocupado);
  useActualizacionVisible(c.actualizar, ocupado || c.cargando || !!accion || bloqueado);
  useEffect(() => {
    onEdicion?.(!!accion || ocupado);
    return () => onEdicion?.(false);
  }, [accion, ocupado, onEdicion]);
  useEffect(() => {
    if (!a) return;
    if (previo.current !== null && previo.current !== a.estado) actualizacion.current?.();
    previo.current = a.estado;
  }, [a?.estado]);
  useEffect(() => {
    if (!emitido) return;
    const t = setTimeout(() => setEmitido(''), 10 * 60 * 1000);
    return () => clearTimeout(t);
  }, [emitido]);
  function cerrar() { setAccion(null); setMotivo(''); setFecha(''); setCodigo(''); setEvidencia(null); setMantenimiento(''); }
  async function ejecutar(fn: () => Promise<unknown>) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await fn(); cerrar(); c.actualizar(); actualizacion.current?.(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos completar la acción.'); c.actualizar(); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  async function elegir() {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true, multiple: false,
      });
      if (r.canceled) return;
      const f = r.assets[0];
      if ((f.size ?? 0) > 8 * 1024 * 1024) throw new Error('La evidencia no puede superar 8 MB.');
      const web = Platform.OS === 'web' ? f.file ?? await (await fetch(f.uri)).blob() : undefined;
      setEvidencia({ nombre: f.name, uri: f.uri, tipo: f.mimeType ?? 'application/octet-stream', contenidoWeb: web });
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos abrir el archivo.'); }
  }
  function guardar() {
    if (!a || !accion) return;
    if (accion === 'llegada') {
      if (!/^\d{8}$/.test(codigo)) { setError('Escribe las ocho cifras que te muestra el cliente.'); return; }
      void ejecutar(() => repo.llegada(orden, codigo)); return;
    }
    if (motivo.trim().length < (accion === 'entrega' ? 20 : 10)) { setError('Describe la acción con más detalle.'); return; }
    if (accion === 'entrega') {
      if (!evidencia) { setError('Adjunta una evidencia JPG, PNG o PDF de hasta 8 MB.'); return; }
      void ejecutar(() => repo.entregar(orden, { revision: a.revision, trabajo: motivo.trim(), evidencia, mantenimiento: mantenimiento || undefined }));
    } else if (accion === 'conforme' || accion === 'observar') {
      void ejecutar(() => repo.conformidad(orden, a.revision, accion === 'conforme', motivo.trim()));
    } else {
      const requiereFecha = accion === 'pausar' || accion === 'reprogramar';
      if (requiereFecha && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha) || isNaN(Date.parse(`${fecha}:00-04:00`)))) {
        setError('Indica la fecha de Bolivia como AAAA-MM-DDTHH:mm.'); return;
      }
      const fechaServidor = requiereFecha ? `${fecha}:00-04:00` : undefined;
      void ejecutar(() => modo === 'coordinacion'
        ? repo.resolver(orden, a.revision, accion, motivo.trim(), fechaServidor)
        : repo.incidencia(orden, a.revision, accion, motivo.trim(), fechaServidor));
    }
  }
  const cerrado = a && ['finalizado', 'cancelado'].includes(a.estado);
  const botones: string[] = [];
  if (a && !cerrado) {
    if (modo === 'tecnico' && !a.entregadoEn) {
      if (a.pausaMotivo) botones.push('reanudar');
      else {
        if (a.estado === 'en_camino') botones.push('llegada', 'cliente_ausente');
        if (['en_diagnostico', 'en_reparacion'].includes(a.estado)) botones.push('pausar');
        if (a.estado === 'en_reparacion') botones.push('entrega');
      }
      botones.push('solicitar_cancelacion', 'solicitar_coordinacion');
    }
    if (modo === 'cliente') {
      if (a.conformidad === 'pendiente') botones.push('conforme', 'observar');
      if (!a.entregadoEn) botones.push('solicitar_coordinacion');
      if (a.estado !== 'solicitado' && !a.entregadoEn) botones.push('solicitar_cancelacion');
    }
    if (modo === 'coordinacion') {
      botones.push('cancelar');
      if (a.estado === 'en_camino') botones.push('llegada_justificada');
      if (['en_camino', 'en_diagnostico', 'en_reparacion'].includes(a.estado) && !a.entregadoEn) botones.push('reprogramar');
      if (a.entregadoEn && (a.conformidad === 'observado' || Date.parse(a.entregadoEn) < Date.now() - 48 * 3600000)) botones.push('cerrar_entrega');
    }
  }
  return <Tarjeta style={{ gap: 14 }}>
    <Texto variante="subtitulo">Atención y trazabilidad</Texto>
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {c.cargando && !a ? <ActivityIndicator /> : null}
    <BotonPrimario titulo="Actualizar atención" variante="secundario" deshabilitado={ocupado || !!accion || bloqueado} onPress={c.actualizar} />
    {a ? <>
      {a.equipo ? <Texto>Equipo: {a.equipo}{a.sucursal ? ` · Sucursal: ${a.sucursal}` : ''}</Texto> : null}
      {a.estado === 'solicitado' ? <Aviso tono={a.busqueda === 'sin_disponibilidad' ? 'advertencia' : 'info'}
        titulo={a.busqueda === 'sin_disponibilidad' ? 'Búsqueda sin disponibilidad' : 'Buscando un técnico de la empresa'}>
        {a.busqueda === 'sin_disponibilidad'
          ? 'No se confirmó una asignación. Puedes reintentar con otros técnicos o pedir ayuda de coordinación.'
          : 'La búsqueda dura hasta 15 minutos. No confirma precio ni hora de llegada.'}
        {a.busquedaHasta ? ` Límite: ${fechaHoraBolivia(a.busquedaHasta)}.` : ''}
      </Aviso> : null}
      {a.estado === 'solicitado' && a.busqueda === 'sin_disponibilidad' && a.intento < 3 && modo === 'cliente'
        ? <BotonPrimario titulo="Solicitar otro intento de asignación" deshabilitado={ocupado || !!accion || bloqueado}
          onPress={() => void ejecutar(() => repo.reintentar(orden, a.revision))} /> : null}
      {a.pausaMotivo ? <Aviso tono="advertencia" titulo="Atención pausada">{a.pausaMotivo}
        {a.reanudarEn ? ` · Continuación prevista: ${fechaHoraBolivia(a.reanudarEn)}` : ''}</Aviso> : null}
      {a.incidencia ? <Aviso tono="advertencia" titulo="Requiere coordinación">{a.incidencia}</Aviso> : null}
      {a.estado === 'en_camino' && !a.pausaMotivo && modo === 'cliente' ? <View style={{ gap: 10 }}>
        <Texto>Genera el código solo cuando el técnico esté contigo. No es un código de acceso ni un pago.</Texto>
        <BotonPrimario titulo="Generar código para confirmar llegada" variante="secundario" deshabilitado={ocupado || bloqueado || !!accion}
          onPress={() => void ejecutar(async () => { setEmitido(await repo.codigo(orden)); })} />
        {emitido ? <><Texto variante="display" accessibilityLabel={`Código de encuentro ${emitido}`}>{emitido}</Texto>
          <Texto variante="caption">Válido por 10 minutos. Se muestra solo en esta pantalla y no se guarda en el dispositivo.</Texto></> : null}
      </View> : null}
      {a.trabajoRealizado ? <View style={{ gap: 8 }}>
        <Texto variante="cuerpoFuerte">Trabajo registrado</Texto><Texto>{a.trabajoRealizado}</Texto>
        <Chip texto={a.conformidad === 'conforme' ? 'Cliente conforme' : a.conformidad === 'observado' ? 'Entrega observada'
          : a.conformidad === 'resuelto_coordinacion' ? 'Cierre resuelto por coordinación' : 'Pendiente de conformidad'} tono="marca" />
        {a.respuestaCliente ? <Texto>Respuesta: {a.respuestaCliente}</Texto> : null}
        {a.proximoMantenimiento ? <Texto>Próximo mantenimiento recomendado: {a.proximoMantenimiento}</Texto> : null}
        {a.evidenciaDisponible ? <BotonPrimario titulo="Descargar evidencia del trabajo" variante="secundario"
          deshabilitado={ocupado || bloqueado || !!accion} onPress={() => void ejecutar(() => repo.descargarEvidencia(orden))} /> : null}
      </View> : null}
      {!accion ? <View style={fila}>{botones.map(b => <BotonPrimario key={b} titulo={etiquetas[b]} variante="secundario"
        deshabilitado={ocupado || bloqueado || c.cargando} onPress={() => { setError(''); setAccion(b); }} />)}</View> : <View style={{ gap: 12 }}>
        <Texto variante="subtitulo">{etiquetas[accion]}</Texto>
        {accion === 'llegada' ? <CampoTexto etiqueta="Código del cliente (8 cifras)" value={codigo} maxLength={8}
          keyboardType="number-pad" editable={!ocupado} onChangeText={v => setCodigo(v.replace(/\D/g, ''))} /> : <>
          <CampoTexto etiqueta={accion === 'entrega' ? 'Trabajo realizado y comprobaciones' : 'Motivo / comentario'}
            value={motivo} multiline maxLength={accion === 'entrega' ? 2000 : 1000} editable={!ocupado} onChangeText={setMotivo} />
          {['pausar', 'reprogramar'].includes(accion) ? <CampoTexto etiqueta="Continuación en Bolivia (AAAA-MM-DDTHH:mm)"
            value={fecha} placeholder="2026-12-01T09:30" editable={!ocupado} onChangeText={setFecha} /> : null}
          {accion === 'entrega' ? <>
            <CampoTexto etiqueta="Mantenimiento recomendado (AAAA-MM-DD, opcional)" value={mantenimiento} maxLength={10}
              editable={!ocupado} onChangeText={setMantenimiento} />
            <BotonPrimario titulo={evidencia ? `Evidencia: ${evidencia.nombre}` : 'Adjuntar evidencia del trabajo'}
              variante="secundario" deshabilitado={ocupado} onPress={() => void elegir()} />
          </> : null}
        </>}
        <Aviso tono="advertencia">Confirma la acción. Quedará registrada con tu cuenta. No registra cobros ni pagos.</Aviso>
        <View style={fila}><BotonPrimario titulo="Confirmar acción" cargando={ocupado} onPress={guardar} />
          <BotonPrimario titulo="Cancelar edición" variante="secundario" deshabilitado={ocupado} onPress={cerrar} /></View>
      </View>}
      <Texto variante="caption">Últimos 50 eventos · horario de Bolivia</Texto>
      {a.eventos.map(e => <View key={e.id} style={{ gap: 4 }}>
        <Texto variante="cuerpoFuerte">{e.motivo}</Texto>
        <Texto variante="caption">{fechaHoraBolivia(e.creadoEn)} · {e.actor ?? 'Actor no registrado'}</Texto>
      </View>)}
    </> : null}
  </Tarjeta>;
}

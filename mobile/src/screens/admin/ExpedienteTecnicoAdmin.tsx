import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Expediente } from '../../domain/models/Expediente';
import { tecnicoRepository as repo } from '../../infrastructure/di';
import { guardarDescarga } from '../../infrastructure/storage/descarga';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';
import { Chip } from '../../ui/Chip';
import { colores } from '../../theme/tokens';

export const camposExpediente = [
  ['ci', 'CI'], ['fechaNacimiento', 'Fecha de nacimiento'], ['ciFrenteUrl', 'CI frente'],
  ['ciDorsoUrl', 'CI dorso'], ['certificacionesUrl', 'Certificados técnicos'],
  ['especialidades', 'Especialidades'], ['zonas', 'Cobertura'],
] as const;
export const estadosExpediente: Record<string, string> = {
  borrador: 'Borrador', en_revision: 'En revisión', observado: 'Observado', aprobado: 'Aprobado', rechazado: 'Rechazado',
};
export const estadosDisponibilidad: Record<string, string> = {
  disponible: 'Disponible', fuera_servicio: 'Fuera de servicio', ocupado: 'Ocupado',
};
const etiquetas = Object.fromEntries(camposExpediente);
const privado = (url: string | null) => !!url && /^\/perfiles\/[a-f0-9-]{36}\.(png|jpg|jpeg|pdf)$/i.test(url);

/** Misma revisión en W49 y W61; las reglas y auditoría siguen en Postgres. */
export function ExpedienteTecnicoAdmin({ id, expediente: d, cuentaActiva, onCambio, onInteraccion }: {
  id: number; expediente: Expediente; cuentaActiva: boolean;
  onCambio: () => void;
  onInteraccion: (sucio: boolean, ocupado: boolean) => void;
}) {
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmacion, setConfirmacion] = useState<'aprobar' | 'observar' | 'rechazar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const bloqueo = useRef(false);
  const sucio = Object.keys(observaciones).length > 0 || motivo !== '' || confirmacion !== null;
  useEffect(() => {
    onInteraccion(sucio, ocupado);
    return () => onInteraccion(false, false);
  }, [sucio, ocupado, onInteraccion]);
  function cancelar() {
    setObservaciones({}); setMotivo(''); setRechazando(false); setConfirmacion(null); setError('');
  }
  async function descargar(url: string) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { guardarDescarga(await repo.descargar(url), url.slice(url.lastIndexOf('/') + 1)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos descargar el documento.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  function preparar(accion: 'aprobar' | 'observar' | 'rechazar') {
    setError('');
    if (accion === 'observar' && (!Object.keys(observaciones).length ||
        Object.values(observaciones).some(v => v.trim().length < 3))) {
      setError('Completa una observación de al menos 3 caracteres para cada campo seleccionado.'); return;
    }
    if (accion === 'rechazar' && motivo.trim().length < 3) {
      setError('Escribe un motivo de rechazo de al menos 3 caracteres.'); return;
    }
    setConfirmacion(accion);
  }
  async function ejecutar() {
    if (bloqueo.current || !confirmacion) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      if (confirmacion === 'aprobar') await repo.aprobar(id);
      if (confirmacion === 'rechazar') await repo.rechazar(id, motivo.trim());
      if (confirmacion === 'observar') await repo.observar(id,
        Object.fromEntries(Object.entries(observaciones).map(([k, v]) => [k, v.trim()])));
      cancelar(); setMensaje('Decisión registrada en el expediente.'); onCambio();
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos registrar la decisión.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  const documentos = [
    { nombre: 'CI frente', url: d.ciFrenteUrl }, { nombre: 'CI dorso', url: d.ciDorsoUrl },
    ...d.certificacionesUrl.map((url, i) => ({ nombre: `Certificado técnico ${i + 1}`, url })),
  ];
  return <View style={s.raiz}>
    <View style={s.fila}><Texto variante="subtitulo">Expediente documental</Texto>
      <Chip texto={estadosExpediente[d.estadoExpediente]} tono={d.estadoExpediente === 'aprobado' ? 'exito' : 'neutro'} /></View>
    <Texto variante="caption">Información privada para revisión administrativa. Nivel {d.nivel}: completitud del expediente, no verificación biométrica.</Texto>
    <View style={s.fila}><View style={s.dato}><Texto variante="caption">CI declarado</Texto><Texto variante="cuerpoFuerte">{d.ci ?? 'No registrado'}</Texto></View>
      <View style={s.dato}><Texto variante="caption">Fecha de nacimiento declarada</Texto><Texto variante="cuerpoFuerte">{d.fechaNacimiento ?? 'No registrada'}</Texto></View></View>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
    {documentos.map(doc => <View key={doc.nombre} style={s.documento}>
      <View style={{ flex: 1, minWidth: 160, gap: 4 }}><Texto variante="etiqueta">{doc.nombre}</Texto>
        <Texto variante="caption">{privado(doc.url) ? 'Archivo privado registrado · descarga autenticada' :
          doc.url ? 'Referencia anterior sin archivo privado descargable' : 'Sin archivo registrado'}</Texto></View>
      {privado(doc.url) ? <BotonPrimario titulo={`Descargar ${doc.nombre}`} tamano="escritorio" variante="secundario"
        deshabilitado={ocupado} onPress={() => void descargar(doc.url!)} /> : <Chip texto={doc.url ? 'Referencia anterior' : 'Pendiente'} />}
    </View>)}
    {!d.certificacionesUrl.length ? <Aviso>No hay certificados técnicos registrados en este expediente.</Aviso> : null}
    {Object.entries(d.observaciones).map(([k, v]) => <Aviso key={k} tono="advertencia" titulo={etiquetas[k] ?? (k === 'motivo' ? 'Motivo del rechazo' : k)}>{v}</Aviso>)}
    {d.estadoExpediente === 'en_revision' ? <>
      <Aviso titulo="Revisión humana">Compara la identidad y la fecha con el CI, y revisa que los certificados sean legibles y correspondan al técnico. Un archivo cargado no prueba su autenticidad.</Aviso>
      {!cuentaActiva ? <Aviso tono="advertencia">La cuenta está inactiva. Aprobar documentos no la reactiva ni habilita su acceso al sistema.</Aviso> : null}
      <Texto variante="etiqueta">Campos a observar</Texto>
      <View style={s.fila}>{camposExpediente.map(([campo, titulo]) => <Pressable key={campo} accessibilityRole="checkbox"
        accessibilityLabel={`Observar ${titulo}`} accessibilityState={{ checked: campo in observaciones }} disabled={ocupado}
        onPress={() => { setObservaciones(p => { const n = { ...p }; if (campo in n) delete n[campo]; else n[campo] = ''; return n; }); setConfirmacion(null); }}
        style={[s.opcion, campo in observaciones && s.seleccionada]}>
        <Texto variante="etiqueta">{campo in observaciones ? '✓ ' : '+ '}{titulo}</Texto></Pressable>)}</View>
      {camposExpediente.filter(([k]) => k in observaciones).map(([k, titulo]) => <CampoTexto key={k} etiqueta={`Observación ${titulo}`}
        value={observaciones[k]} maxLength={500} editable={!ocupado}
        onChangeText={v => { setObservaciones(p => ({ ...p, [k]: v })); setConfirmacion(null); }} />)}
      <View style={s.fila}><BotonPrimario titulo="Aprobar expediente" tamano="escritorio"
        deshabilitado={ocupado || Object.keys(observaciones).length > 0 || rechazando} onPress={() => preparar('aprobar')} />
        {Object.keys(observaciones).length ? <BotonPrimario titulo="Revisar observaciones" variante="secundario" tamano="escritorio"
          deshabilitado={ocupado || rechazando} onPress={() => preparar('observar')} /> : null}</View>
    </> : null}
    {['en_revision', 'observado'].includes(d.estadoExpediente) ? <>
      {!rechazando ? <BotonPrimario titulo="Rechazar expediente" variante="secundario" tamano="escritorio" deshabilitado={ocupado}
        onPress={() => { setRechazando(true); setConfirmacion(null); }} /> : <>
        <CampoTexto etiqueta="Motivo del rechazo" value={motivo} maxLength={500} editable={!ocupado}
          onChangeText={v => { setMotivo(v); setConfirmacion(null); }} />
        <BotonPrimario titulo="Revisar rechazo" variante="secundario" tamano="escritorio" deshabilitado={ocupado}
          onPress={() => preparar('rechazar')} />
      </>}
    </> : null}
    {confirmacion ? <View style={s.confirmacion}>
      <Aviso tono={confirmacion === 'aprobar' ? 'info' : 'advertencia'} titulo="Confirma tu decisión">
        {confirmacion === 'aprobar' ? 'Se registrará tu aprobación documental. La cuenta debe estar activa para acceder a Fixly.' :
          confirmacion === 'observar' ? 'El técnico deberá corregir cada campo observado y volver a enviar el expediente.' :
            'El expediente quedará rechazado y el técnico no tendrá acceso al panel operativo. Esta decisión queda auditada.'}
      </Aviso>
      <BotonPrimario titulo={confirmacion === 'aprobar' ? 'Confirmar aprobación' : confirmacion === 'observar' ? 'Confirmar observaciones' : 'Confirmar rechazo'}
        tamano="escritorio" cargando={ocupado} onPress={() => void ejecutar()} />
    </View> : null}
    {sucio || rechazando ? <BotonPrimario titulo="Cancelar revisión" variante="secundario" tamano="escritorio" deshabilitado={ocupado} onPress={cancelar} /> : null}
    {d.estadoExpediente === 'borrador' ? <Aviso>Este expediente todavía no fue enviado. No se puede aprobar desde borrador.</Aviso> : null}
  </View>;
}
const s = StyleSheet.create({
  raiz: { gap: 20 }, fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  dato: { minWidth: 200, gap: 4, flex: 1 }, documento: { padding: 16, gap: 12, flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', borderWidth: 1, borderColor: colores.linea, borderRadius: 12, backgroundColor: colores.fondo },
  opcion: { padding: 12, borderWidth: 1, borderColor: colores.linea, borderRadius: 10 },
  seleccionada: { borderColor: colores.marca, backgroundColor: colores.marcaSuave },
  confirmacion: { gap: 12, borderTopWidth: 1, borderTopColor: colores.linea, paddingTop: 20 },
});

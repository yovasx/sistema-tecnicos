import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Expediente, ExpedienteAdmin } from '../../domain/models/Expediente';
import { tecnicoRepository as repo } from '../../infrastructure/di';
import { guardarDescarga } from '../../infrastructure/storage/descarga';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { Encabezado } from '../../ui/Encabezado';
import { colores } from '../../theme/tokens';

const CAMPOS = [
  ['ci', 'CI'], ['fechaNacimiento', 'Fecha de nacimiento'], ['ciFrenteUrl', 'CI frente'],
  ['ciDorsoUrl', 'CI dorso'], ['certificacionesUrl', 'Certificados técnicos'],
  ['especialidades', 'Especialidades'], ['zonas', 'Cobertura'],
] as const;

/** Cola real: solo expedientes enviados, no todas las cuentas en borrador. */
export function ValidacionAdminScreen() {
  const [estado, setEstado] = useState('en_revision');
  const [lista, setLista] = useState<ExpedienteAdmin[]>([]);
  const [seleccionado, setSeleccionado] = useState<ExpedienteAdmin | null>(null);
  const [detalle, setDetalle] = useState<Expediente | null>(null);
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState('');
  const [confirmar, setConfirmar] = useState<'aprobar' | 'rechazar' | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const consulta = useRef(0);
  const cargar = useCallback(async () => {
    const actual = ++consulta.current;
    setError(''); setOcupado(true);
    try { const datos = await repo.cola(estado); if (actual === consulta.current) setLista(datos); }
    catch (e) { if (actual === consulta.current) setError(e instanceof Error ? e.message : 'No pudimos cargar la cola.'); }
    finally { if (actual === consulta.current) setOcupado(false); }
  }, [estado]);
  useEffect(() => { setSeleccionado(null); setDetalle(null); void cargar(); }, [cargar]);
  async function abrir(fila: ExpedienteAdmin) {
    if (bloqueo.current) return;
    const actual = ++consulta.current;
    setError(''); setDetalle(null); setSeleccionado(fila); setOcupado(true);
    setObservaciones({}); setMotivo(''); setConfirmar(null); setMensaje('');
    try { const datos = await repo.detalleAdmin(fila.tecnicoId); if (actual === consulta.current) setDetalle(datos); }
    catch (e) { if (actual === consulta.current) setError(e instanceof Error ? e.message : 'No pudimos cargar el expediente.'); }
    finally { if (actual === consulta.current) setOcupado(false); }
  }
  async function accion(operacion: () => Promise<void>, texto: string) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      await operacion(); setSeleccionado(null); setDetalle(null); setConfirmar(null);
      setMensaje(texto); setLista(await repo.cola(estado));
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la revisión.'); }
    finally { setOcupado(false); bloqueo.current = false; }
  }
  async function descargar(url: string) {
    setOcupado(true); setError('');
    try { guardarDescarga(await repo.descargar(url), url.slice(url.lastIndexOf('/') + 1)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos descargar el documento.'); }
    finally { setOcupado(false); }
  }
  return (
    <View style={s.raiz}>
      <Encabezado titulo="Validar técnicos" subtitulo="Email y completitud automáticos. La identidad y los certificados requieren revisión documental." />
      <View style={s.fila}>
        {[['en_revision', 'En revisión'], ['observado', 'Observados'], ['aprobado', 'Aprobados'], ['rechazado', 'Rechazados']].map(([valor, titulo]) => (
          <Pressable key={valor} accessibilityRole="button" accessibilityState={{ selected: estado === valor }}
            disabled={ocupado} onPress={() => setEstado(valor)} style={[s.filtro, estado === valor && s.activo]}>
            <Texto variante="etiqueta">{titulo}</Texto>
          </Pressable>
        ))}
        <BotonPrimario titulo="Actualizar cola" tamano="escritorio" variante="secundario" deshabilitado={ocupado} onPress={() => void cargar()} />
      </View>
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
      {ocupado ? <Texto variante="caption">Procesando…</Texto> : null}
      {!lista.length && !ocupado && !error ? <Aviso titulo="Nada por validar">No hay expedientes en este estado. Los borradores no aparecen en esta cola.</Aviso> : null}
      {lista.map((t) => (
        <Pressable key={t.tecnicoId} accessibilityRole="button" disabled={ocupado} onPress={() => void abrir(t)} style={s.tarjeta}>
          <Texto variante="cuerpoFuerte">{t.nombre}</Texto>
          <Texto variante="caption">{t.email} · CI {t.ci} · {t.estadoExpediente.replace('_', ' ')}</Texto>
          <Texto variante="etiqueta" color={colores.marca}>Revisar expediente →</Texto>
        </Pressable>
      ))}
      {seleccionado && detalle ? <View style={s.tarjeta}>
        <Texto variante="titulo">{seleccionado.nombre}</Texto>
        <Texto>CI: {detalle.ci} · Nacimiento: {detalle.fechaNacimiento}</Texto>
        <Texto variante="caption">Email: {detalle.emailVerificadoEn ? 'Verificado' : 'Sin verificar'} · {detalle.email}</Texto>
        <Texto variante="caption">Especialidades: {detalle.especialidades.map((c) => c.nombre).join(', ')}</Texto>
        <Texto variante="caption">Cobertura: {detalle.zonas.map((z) => `${z.nombre} (${z.radio} m)`).join(', ')}</Texto>
        <Aviso titulo="Revisión manual">Compará nombre, CI y fecha con el documento. Comprobá que los certificados sean legibles y correspondan a la especialidad. La carga de archivos no prueba por sí sola su autenticidad.</Aviso>
        <View style={s.fila}>
          {[
            { nombre: 'Descargar CI frente', url: detalle.ciFrenteUrl },
            { nombre: 'Descargar CI dorso', url: detalle.ciDorsoUrl },
            ...detalle.certificacionesUrl.map((url, i) => ({ nombre: `Descargar certificado ${i + 1}`, url })),
          ].filter((d) => d.url).map((d) => (
            <BotonPrimario key={d.nombre} titulo={d.nombre} tamano="escritorio" variante="secundario"
              deshabilitado={ocupado} onPress={() => void descargar(d.url!)} />
          ))}
        </View>
        {Object.entries(detalle.observaciones).map(([campo, texto]) => <Aviso key={campo} titulo={campo} tono="peligro">{texto}</Aviso>)}
        {detalle.estadoExpediente === 'en_revision' ? <>
          <Texto variante="subtitulo">Observar campos concretos</Texto>
          <Texto variante="caption">Completá solo los campos que deban corregirse. El técnico conservará el resto del expediente.</Texto>
          {CAMPOS.map(([campo, etiqueta]) => <CampoTexto key={campo} etiqueta={etiqueta} accessibilityLabel={`Observación ${etiqueta}`}
            value={observaciones[campo] ?? ''} maxLength={500}
            onChangeText={(valor) => setObservaciones((p) => ({ ...p, [campo]: valor }))} placeholder="Sin observación" />)}
          <BotonPrimario titulo="Enviar observaciones" variante="secundario" tamano="escritorio" cargando={ocupado} onPress={() => {
            const obs = Object.fromEntries(Object.entries(observaciones).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
            if (!Object.keys(obs).length || Object.values(obs).some((v) => v.length < 3)) { setError('Escribí al menos una observación de 3 caracteres.'); return; }
            void accion(() => repo.observar(seleccionado.tecnicoId, obs), 'Observaciones enviadas al expediente.');
          }} />
          <BotonPrimario titulo="Aprobar expediente" tamano="escritorio"
            deshabilitado={ocupado || Object.values(observaciones).some((v) => v.trim().length > 0)}
            onPress={() => setConfirmar('aprobar')} />
        </> : null}
        {['en_revision', 'observado'].includes(detalle.estadoExpediente) ? <>
          <CampoTexto etiqueta="Motivo del rechazo" accessibilityLabel="Motivo del rechazo" value={motivo} onChangeText={setMotivo} maxLength={500} />
          <BotonPrimario titulo="Rechazar expediente" tamano="escritorio" variante="secundario" deshabilitado={ocupado || motivo.trim().length < 3} onPress={() => setConfirmar('rechazar')} />
        </> : null}
        {confirmar ? <View style={{ gap: 12 }}>
          <Aviso tono="info" titulo="Confirmá tu decisión">{confirmar === 'aprobar' ? 'Al aprobar, el técnico quedará habilitado para recibir servicios.' : 'El técnico verá el motivo y no podrá recibir servicios.'}</Aviso>
          <BotonPrimario titulo={confirmar === 'aprobar' ? 'Confirmar aprobación' : 'Confirmar rechazo'} tamano="escritorio" cargando={ocupado}
            onPress={() => void accion(() => confirmar === 'aprobar' ? repo.aprobar(seleccionado.tecnicoId) : repo.rechazar(seleccionado.tecnicoId, motivo.trim()), 'Revisión completada.')} />
          <BotonPrimario titulo="Cancelar decisión" variante="secundario" tamano="escritorio" deshabilitado={ocupado} onPress={() => setConfirmar(null)} />
        </View> : null}
      </View> : null}
    </View>
  );
}
const s = StyleSheet.create({
  raiz: { gap: 20 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  filtro: { padding: 12, borderWidth: 1, borderColor: colores.linea, borderRadius: 12 },
  activo: { backgroundColor: colores.marcaSuave, borderColor: colores.marca },
  tarjeta: { padding: 24, gap: 16, backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.linea, borderRadius: 16 },
});

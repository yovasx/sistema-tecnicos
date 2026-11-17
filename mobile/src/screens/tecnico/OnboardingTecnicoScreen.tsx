import { ComponentRef, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { DocumentosExpediente, Especialidad, Expediente } from '../../domain/models/Expediente';
import { tecnicoRepository as repo } from '../../infrastructure/di';
import { ubicacionActual } from '../../infrastructure/ubicacion/ubicacionActual';
import { useSesion } from '../../session/SesionProvider';
import { MarcoPublico } from '../publico/MarcoPublico';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { useResponsive } from '../../theme/responsive';
import { colores, radio } from '../../theme/tokens';

const PASOS = ['Tus datos', 'Documentos', 'Especialidades', 'Cobertura', 'Revisión'];
const CAMPOS: Record<string, string> = {
  ci: 'CI', fechaNacimiento: 'Fecha de nacimiento', ciFrenteUrl: 'CI frente', ciDorsoUrl: 'CI dorso',
  certificacionesUrl: 'Certificados técnicos', especialidades: 'Especialidades', zonas: 'Cobertura',
};
function completos(e: Expediente) {
  return [!!e.ci && !!e.fechaNacimiento,
    !!e.ciFrenteUrl && !!e.ciDorsoUrl && e.certificacionesUrl.length > 0,
    e.especialidades.length > 0, e.zonas.length > 0];
}

/** Expediente reanudable. No afirma validación biométrica ni solicita cobros/REJAP. */
export function OnboardingTecnicoScreen({ expediente: e, onCambiar, onActualizar }: {
  expediente: Expediente; onCambiar: (e: Expediente) => void; onActualizar: () => Promise<void>;
}) {
  const { esDesktop } = useResponsive();
  const { cerrarSesion } = useSesion();
  const [paso, setPaso] = useState(() => {
    const pendiente = completos(e).findIndex((v) => !v);
    return pendiente < 0 ? 4 : pendiente;
  });
  const [ci, setCi] = useState(e.ci ?? '');
  const [fecha, setFecha] = useState(e.fechaNacimiento ?? '');
  const [archivos, setArchivos] = useState<DocumentosExpediente>({});
  const [categorias, setCategorias] = useState<Especialidad[]>([]);
  const [seleccion, setSeleccion] = useState(e.especialidades.map((c) => c.id));
  const [zona, setZona] = useState(e.zonas[0]?.nombre ?? '');
  const [lat, setLat] = useState(e.zonas[0]?.lat.toString() ?? '');
  const [lng, setLng] = useState(e.zonas[0]?.lng.toString() ?? '');
  const [radioMetros, setRadio] = useState(e.zonas[0]?.radio.toString() ?? '1500');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [coordenadas, setCoordenadas] = useState(false);
  const bloqueo = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const tamano = esDesktop ? 'escritorio' as const : 'movil' as const;

  useEffect(() => {
    let vigente = true;
    repo.categorias().then((c) => { if (vigente) setCategorias(c); })
      .catch(() => { if (vigente) setError('No pudimos cargar las especialidades. Usá Actualizar estado.'); });
    return () => { vigente = false; };
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' || paso === 0) return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => { setPaso((v) => Math.max(0, v - 1)); return true; });
    return () => s.remove();
  }, [paso]);
  function ir(p: number) {
    if (ocupado) return;
    setError(''); setMensaje(''); setPaso(p); scroll.current?.scrollTo({ y: 0, animated: true });
  }
  async function accion(operacion: () => Promise<void>, avanzar = false,
                         aviso = 'Guardado. Podés continuar más tarde sin perder tu avance.') {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError(''); setMensaje('');
    try {
      await operacion();
      const actual = await repo.expediente();
      onCambiar(actual);
      if (avanzar) { setPaso((v) => Math.min(v + 1, 4)); scroll.current?.scrollTo({ y: 0 }); }
      setMensaje(aviso);
    } catch (ex) { setError(ex instanceof Error ? ex.message : 'No pudimos guardar los datos.'); }
    finally { setOcupado(false); bloqueo.current = false; }
  }
  async function elegir(tipo: 'frente' | 'dorso' | 'certificados') {
    if (ocupado) return;
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'], multiple: tipo === 'certificados',
        copyToCacheDirectory: true, base64: false,
      });
      if (resultado.canceled) return;
      if (resultado.assets.length > 5 || resultado.assets.some((a) => (a.size ?? 0) > 8 * 1024 * 1024)) {
        setError('Elegí hasta 5 certificados. Cada archivo puede pesar hasta 8 MB.'); return;
      }
      const lista = resultado.assets.map((a) => ({
        nombre: a.name, uri: a.uri, tipo: a.mimeType ?? 'application/octet-stream', tamano: a.size, contenidoWeb: a.file,
      }));
      setArchivos((previos) => ({ ...previos, [tipo]: tipo === 'certificados' ? lista : lista[0] }));
      setError('');
    } catch { setError('No pudimos abrir el selector de archivos. Intentá de nuevo.'); }
  }
  const terminados = completos(e);
  const editable = e.estadoExpediente === 'borrador' || e.estadoExpediente === 'observado';
  const todos = terminados.every(Boolean) && Object.keys(e.observaciones).length === 0;

  return (
    <MarcoPublico>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, esDesktop && s.desktop]}>
            <View style={[s.caja, esDesktop && s.cajaDesktop]}>
              <View style={s.cabecera}>
                <Texto variante="etiqueta" color={colores.marca}>Fixly · Alta de técnico</Texto>
                <Texto accessibilityRole="button" onPress={() => void cerrarSesion()} color={colores.secundario} variante="etiqueta">Cerrar sesión</Texto>
              </View>
              <Texto variante="titulo">{editable ? 'Prepará tu perfil profesional' : 'Estado de tu expediente'}</Texto>
              <Texto variante="caption">Tu avance se guarda en tu cuenta. No recibirás servicios hasta que aprobemos tu expediente.</Texto>
              {Object.entries(e.observaciones).map(([campo, motivo]) => (
                <Aviso key={campo} tono="peligro" titulo={CAMPOS[campo] ?? 'Resultado de la revisión'}>{motivo}</Aviso>
              ))}
              {editable ? <View style={esDesktop ? s.layout : undefined}>
                <ScrollView horizontal={!esDesktop} showsHorizontalScrollIndicator={false}
                  style={esDesktop ? { width: 180, flexGrow: 0 } : { flexGrow: 0 }}
                  contentContainerStyle={[s.pasos, esDesktop && s.pasosDesktop]}>
                  {PASOS.map((nombre, i) => (
                    <Pressable key={nombre} accessibilityRole="button" accessibilityState={{ selected: paso === i }}
                      disabled={ocupado} onPress={() => ir(i)}
                      style={[s.paso, paso === i && s.pasoActual]}>
                      <Texto variante="caption" color={paso === i ? colores.marca : colores.secundario}>
                        {terminados[i] ? '✓' : i + 1} {nombre}
                      </Texto>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={s.formulario}>
                <Texto variante="subtitulo">Paso {paso + 1} de 5 · {PASOS[paso]}</Texto>
                {error ? <Aviso tono="peligro" titulo="Revisá este paso">{error}</Aviso> : null}
                {mensaje ? <Aviso tono="info">{mensaje}</Aviso> : null}

                {paso === 0 ? <>
                  <CampoTexto etiqueta="CI (con complemento si corresponde)" accessibilityLabel="CI" value={ci}
                    onChangeText={setCi} maxLength={20} placeholder="1234567-1A" autoCapitalize="characters" />
                  <CampoTexto etiqueta="Fecha de nacimiento (AAAA-MM-DD)" accessibilityLabel="Fecha de nacimiento"
                    value={fecha} onChangeText={setFecha} placeholder="1990-01-25" maxLength={10} />
                  <Texto variante="caption">Debés tener entre 18 y 100 años. El CI debe coincidir con tus documentos.</Texto>
                  <BotonPrimario titulo="Guardar y continuar" tamano={tamano} cargando={ocupado} onPress={() => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !ci.trim()) { setError('Completá el CI y una fecha con formato AAAA-MM-DD.'); return; }
                    void accion(() => repo.guardarDatos(ci.trim(), fecha), true);
                  }} />
                </> : null}
                {paso === 1 ? <>
                  <Texto color={colores.secundario}>Subí documentos legibles, sin recortar los bordes. Solo vos y el equipo autorizado pueden acceder.</Texto>
                  <Texto variante="caption">JPG, PNG o PDF · Hasta 8 MB por archivo · Hasta 5 certificados técnicos.</Texto>
                  <Documento titulo="CI frente" nombre={archivos.frente?.nombre} cargado={!!e.ciFrenteUrl} ocupado={ocupado} onElegir={() => void elegir('frente')} />
                  <Documento titulo="CI dorso" nombre={archivos.dorso?.nombre} cargado={!!e.ciDorsoUrl} ocupado={ocupado} onElegir={() => void elegir('dorso')} />
                  <Documento titulo="Certificados técnicos" nombre={archivos.certificados?.map((a) => a.nombre).join(', ')}
                    cargado={!!e.certificacionesUrl.length} ocupado={ocupado} onElegir={() => void elegir('certificados')} />
                  <BotonPrimario titulo="Guardar y continuar" tamano={tamano} cargando={ocupado} onPress={() => {
                    if (!(archivos.frente || e.ciFrenteUrl) || !(archivos.dorso || e.ciDorsoUrl) || !(archivos.certificados?.length || e.certificacionesUrl.length)) {
                      setError('Necesitamos ambas caras del CI y al menos un certificado técnico.'); return;
                    }
                    void accion(async () => {
                      if (Object.keys(archivos).length) { await repo.documentos(archivos); setArchivos({}); }
                    }, true);
                  }} />
                </> : null}
                {paso === 2 ? <>
                  <Texto variante="caption">Elegí los servicios que podés acreditar con tus certificados.</Texto>
                  {categorias.map((c) => (
                    <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: seleccion.includes(c.id) }}
                      onPress={() => setSeleccion((v) => v.includes(c.id) ? v.filter((id) => id !== c.id) : [...v, c.id])}
                      style={[s.opcion, seleccion.includes(c.id) && s.pasoActual]}>
                      <Ionicons name={seleccion.includes(c.id) ? 'checkbox' : 'square-outline'} size={22} color={colores.marca} />
                      <Texto>{c.nombre}</Texto>
                    </Pressable>
                  ))}
                  <BotonPrimario titulo="Guardar y continuar" tamano={tamano} cargando={ocupado} deshabilitado={!seleccion.length}
                    onPress={() => void accion(() => repo.especialidades(seleccion), true)} />
                </> : null}
                {paso === 3 ? <>
                  <Texto variante="caption">Definí el centro y el radio de tu cobertura. Usá tu ubicación actual o ingresá las coordenadas de la zona donde querés trabajar. No rastreamos tu ubicación.</Texto>
                  <CampoTexto etiqueta="Nombre de la zona" accessibilityLabel="Nombre de la zona" value={zona} onChangeText={setZona} placeholder="Sopocachi" />
                  <BotonPrimario titulo="Usar mi ubicación como centro" variante="secundario" tamano={tamano}
                    cargando={ocupado} onPress={() => {
                      if (ocupado) return;
                      setOcupado(true); setError('');
                      void ubicacionActual().then((p) => { setLat(p.lat.toFixed(6)); setLng(p.lng.toFixed(6)); })
                        .catch((ex) => setError(ex instanceof Error ? ex.message : 'Ubicación no disponible. Ingresá las coordenadas.'))
                        .finally(() => setOcupado(false));
                    }} />
                  <Texto color={colores.marca} variante="etiqueta" accessibilityRole="button"
                    onPress={() => setCoordenadas((v) => !v)}>{coordenadas ? 'Ocultar coordenadas' : 'Ingresar coordenadas manualmente'}</Texto>
                  {coordenadas ? <>
                    <CampoTexto etiqueta="Latitud" value={lat} onChangeText={setLat} placeholder="-16.51" keyboardType="numbers-and-punctuation" />
                    <CampoTexto etiqueta="Longitud" value={lng} onChangeText={setLng} placeholder="-68.12" keyboardType="numbers-and-punctuation" />
                  </> : null}
                  {lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? (
                    <Texto color={colores.marca} accessibilityRole="link" onPress={() => {
                      void Linking.openURL(`https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=15/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`)
                        .catch(() => setError('No pudimos abrir el mapa.'));
                    }}>Ver centro en OpenStreetMap (sitio externo)</Texto>
                  ) : null}
                  <CampoTexto etiqueta="Radio en metros (100–20000)" accessibilityLabel="Radio en metros" value={radioMetros} onChangeText={setRadio} keyboardType="number-pad" />
                  <BotonPrimario titulo="Guardar cobertura" tamano={tamano} cargando={ocupado} onPress={() => {
                    const numeros = [lat, lng, radioMetros].map((n) => Number(n.replace(',', '.')));
                    if (!zona.trim() || [lat, lng, radioMetros].some((v) => !v.trim()) || numeros.some((v) => !Number.isFinite(v))) {
                      setError('Completá la zona, las coordenadas y el radio.'); return;
                    }
                    void accion(() => repo.zona(zona.trim(), numeros[0], numeros[1], numeros[2]), true);
                  }} />
                </> : null}
                {paso === 4 ? <>
                  <Texto variante="caption">Revisá los pasos antes de enviar. El equipo revisará tus documentos; subirlos no significa estar aprobado.</Texto>
                  {PASOS.slice(0, 4).map((nombre, i) => (
                    <Pressable key={nombre} accessibilityRole="button" onPress={() => ir(i)} style={s.opcion}>
                      <Ionicons name={terminados[i] ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={terminados[i] ? colores.exito : colores.terciario} />
                      <Texto>{nombre}: {terminados[i] ? 'Completado' : 'Pendiente'}</Texto>
                    </Pressable>
                  ))}
                  <BotonPrimario titulo={e.estadoExpediente === 'observado' ? 'Reenviar expediente' : 'Enviar a revisión'}
                    tamano={tamano} cargando={ocupado} deshabilitado={!todos} onPress={() => void accion(() => repo.enviar())} />
                </> : null}
                {paso > 0 ? <Texto accessibilityRole="button" color={colores.marca} onPress={() => ir(paso - 1)}>← Paso anterior</Texto> : null}
                </View>
              </View> : (
                <Aviso tono={e.estadoExpediente === 'rechazado' ? 'peligro' : 'info'}
                  titulo={e.estadoExpediente === 'rechazado' ? 'Tu expediente fue rechazado' : 'Expediente en revisión'}>
                  {e.estadoExpediente === 'rechazado' ? 'Leé el motivo indicado. Si creés que es un error, contactá a soporte@fixly.bo.' :
                    'Recibimos tus datos y documentos. El equipo está revisando el CI y tus certificados. Podés volver más tarde y actualizar el estado.'}
                </Aviso>
              )}
              <BotonPrimario titulo="Actualizar estado" variante="secundario" tamano={tamano} deshabilitado={ocupado} onPress={() => void onActualizar()} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MarcoPublico>
  );
}
const s = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, alignItems: 'center' },
  desktop: { padding: 32 },
  caja: { width: '100%', maxWidth: 600, gap: 24 },
  cajaDesktop: { maxWidth: 960, padding: 32, backgroundColor: colores.superficie, borderRadius: radio.tarjeta, borderWidth: 1, borderColor: colores.linea },
  layout: { flexDirection: 'row', gap: 32 },
  formulario: { flex: 1, minWidth: 0, gap: 16 },
  cabecera: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  pasos: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  pasosDesktop: { flexDirection: 'column' },
  paso: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colores.linea },
  pasoActual: { backgroundColor: colores.marcaSuave, borderColor: colores.marca },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: colores.linea, borderRadius: 12 },
});

function Documento({ titulo, nombre, cargado, ocupado, onElegir }: {
  titulo: string; nombre?: string; cargado: boolean; ocupado: boolean; onElegir: () => void;
}) {
  return <View style={[s.opcion, { alignItems: 'flex-start', padding: 16, backgroundColor: colores.superficie }]}>
    <Ionicons name={cargado ? 'document-text' : 'cloud-upload-outline'} size={28} color={colores.marca} />
    <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
      <Texto variante="cuerpoFuerte">{titulo}</Texto>
      <Texto variante="caption">{nombre ?? (cargado ? 'Documento guardado de forma privada' : 'Pendiente de cargar')}</Texto>
      <Texto variante="etiqueta" color={colores.marca} accessibilityRole="button"
        accessibilityLabel={`${nombre || cargado ? 'Reemplazar' : 'Elegir'} ${titulo}`}
        onPress={() => { if (!ocupado) onElegir(); }} style={{ paddingVertical: 8 }}>
        {nombre || cargado ? 'Reemplazar archivo' : 'Elegir archivo'}
      </Texto>
      {nombre ? <Texto variante="caption" color={colores.info}>Seleccionado · guardá para subirlo</Texto> : null}
    </View>
  </View>;
}

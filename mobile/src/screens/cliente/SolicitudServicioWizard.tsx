import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { CategoriaSolicitud } from '../../domain/models/SolicitudServicio';
import { solicitudesRepository, operacionRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';
import { ubicacionActual } from '../../infrastructure/ubicacion/ubicacionActual';
import { useSolicitudServicio } from '../../session/SolicitudServicioProvider';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip } from '../../ui/Chip';
import { Mapa } from '../../ui/mapa/Mapa';
import { PuntoMapa } from '../../ui/mapa/contrato';
import { Texto } from '../../ui/Texto';
import { useAvisoSalida } from '../../ui/admin/useAvisoSalida';
import { bolivianos } from '../../ui/formato';
import { useResponsive } from '../../theme/responsive';
import { colores, espacio, radio } from '../../theme/tokens';
import { iconoCategoria } from '../publico/categorias';
import { estadoServicio } from './estadosServicio';
import { ElegirDireccionGuardada } from './ElegirDireccionGuardada';

const PASOS = ['Categoría', 'Detalle', 'Ubicación', 'Confirmar'];
const MAX_EVIDENCIA = 8 * 1024 * 1024;

function errorDescripcion(valor: string): string {
  const largo = valor.trim().length;
  if (largo === 0) return 'Describe qué necesitas arreglar.';
  if (largo < 10) return 'Escribe al menos 10 caracteres.';
  if (largo > 2000) return 'La descripción no puede superar los 2000 caracteres.';
  return '';
}

function errorReferencia(valor: string): string {
  const largo = valor.trim().length;
  if (largo === 0) return 'Ingresa una dirección o referencia.';
  if (largo < 5) return 'Agrega un poco más de detalle (mínimo 5 caracteres).';
  if (largo > 300) return 'La referencia no puede superar los 300 caracteres.';
  return '';
}

function coordenada(valor: string, limite: number): number | null {
  if (valor.trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && Math.abs(numero) <= limite ? numero : null;
}

/**
 * Alta de la solicitud de servicio.
 *
 * <p>Se abre como panel sobre el shell actual (móvil y escritorio). No asigna
 * técnico ni promete precios: solo crea la orden en estado `solicitado`.</p>
 */
export function SolicitudServicioWizard() {
  const { esDesktop } = useResponsive();
  const {
    abierta,
    borrador,
    cambiar,
    paso,
    ir,
    ocupado,
    incierto,
    resultado,
    error,
    enviar,
    cerrar,
  } = useSolicitudServicio();

  const [categorias, setCategorias] = useState<CategoriaSolicitud[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(false);
  const [errorCategorias, setErrorCategorias] = useState('');
  const [intento, setIntento] = useState(0);
  const [intentado, setIntentado] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState('');
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [coordenadasManuales, setCoordenadasManuales] = useState(false);
  const [errorEvidencia, setErrorEvidencia] = useState('');

  const sucio =
    !resultado &&
    (borrador.categoria !== null ||
      borrador.descripcion.trim() !== '' ||
      borrador.latitud !== '' ||
      borrador.longitud !== '' ||
      borrador.referencia.trim() !== '' ||
      borrador.urgencia ||
      Boolean(borrador.evidencia));

  useEffect(() => {
    if (!abierta) setCoordenadasManuales(false);
  }, [abierta]);

  useAvisoSalida(abierta && sucio);

  useEffect(() => {
    if (!abierta) return;
    let vigente = true;
    setCargandoCategorias(true);
    setErrorCategorias('');
    solicitudesRepository
      .categorias()
      .then((lista) => {
        if (vigente) setCategorias(lista);
      })
      .catch((e) => {
        if (!vigente) return;
        setErrorCategorias(
          (e as ErrorApi).sinConexion
            ? 'No pudimos cargar las categorías. Revisa tu conexión.'
            : 'No pudimos cargar las categorías.',
        );
      })
      .finally(() => {
        if (vigente) setCargandoCategorias(false);
      });
    return () => {
      vigente = false;
    };
  }, [abierta, intento]);

  useEffect(() => {
    if (!abierta) {
      setIntentado(false);
      setConfirmarCierre(false);
      setErrorUbicacion('');
      setErrorEvidencia('');
    }
  }, [abierta]);

  useEffect(() => {
    setIntentado(false);
  }, [paso]);

  const errorDesc = errorDescripcion(borrador.descripcion);
  const errorRef = errorReferencia(borrador.referencia);
  const lat = coordenada(borrador.latitud, 90);
  const lng = coordenada(borrador.longitud, 180);
  const ubicacionElegida = lat !== null && lng !== null;
  const puntoMapa: PuntoMapa = ubicacionElegida
    ? { latitud: lat, longitud: lng }
    : { latitud: -16.5, longitud: -68.13 };
  const errorLat = borrador.latitud.trim() === ''
    ? 'Ingresa la latitud o selecciona un punto en el mapa.'
    : lat === null ? 'Entre -90 y 90.' : '';
  const errorLng =
    borrador.longitud.trim() === ''
      ? 'Ingresa la longitud o selecciona un punto en el mapa.'
      : lng === null ? 'Entre -180 y 180.' : '';

  const puedeAvanzar =
    paso === 0
      ? borrador.categoria !== null
      : paso === 1
        ? errorDesc === ''
        : paso === 2
          ? errorLat === '' && errorLng === '' && errorRef === ''
          : borrador.categoria !== null && errorDesc === '' && errorLat === '' && errorLng === '' && errorRef === '';

  function avanzar() {
    if (ocupado) return;
    if (incierto) {
      if (paso === PASOS.length - 1) void enviar();
      return;
    }
    if (!puedeAvanzar) {
      setIntentado(true);
      return;
    }
    if (paso < PASOS.length - 1) {
      ir(paso + 1);
    } else {
      void enviar();
    }
  }

  function pedirCierre() {
    if (ocupado) return;
    if (sucio) setConfirmarCierre(true);
    else cerrar();
  }

  async function usarUbicacion() {
    if (buscandoUbicacion || ocupado || incierto) return;
    setBuscandoUbicacion(true);
    setErrorUbicacion('');
    try {
      if (!(await operacionRepository.preferencias()).permitirGps)
        throw new Error('El GPS puntual está desactivado en Configuración y privacidad. Puedes elegir el punto en el mapa.');
      const punto = await ubicacionActual();
      cambiar((b) => ({
        ...b,
        latitud: punto.lat.toFixed(6),
        longitud: punto.lng.toFixed(6),
      }));
    } catch (e) {
      setErrorUbicacion(
        e instanceof Error ? e.message : 'No pudimos obtener tu ubicación.',
      );
    } finally {
      setBuscandoUbicacion(false);
    }
  }

  function seleccionarUbicacion(punto: PuntoMapa) {
    setErrorUbicacion('');
    cambiar((b) => ({
      ...b,
      latitud: punto.latitud.toFixed(6),
      longitud: punto.longitud.toFixed(6),
    }));
  }

  async function elegirEvidencia() {
    if (ocupado || incierto) return;
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });
      if (r.canceled) return;
      const archivo = r.assets[0];
      if ((archivo.size ?? 0) > MAX_EVIDENCIA) {
        setErrorEvidencia('La evidencia puede pesar hasta 8 MB.');
        return;
      }
      cambiar((b) => ({
        ...b,
        evidencia: {
          nombre: archivo.name,
          uri: archivo.uri,
          tipo: archivo.mimeType ?? 'application/octet-stream',
          tamano: archivo.size,
          contenidoWeb: archivo.file,
        },
      }));
      setErrorEvidencia('');
    } catch {
      setErrorEvidencia('No pudimos abrir el selector de archivos. Intenta de nuevo.');
    }
  }

  const categoriaElegida = categorias.find((c) => c.id === borrador.categoria) ?? null;
  const estado = resultado ? estadoServicio(resultado.estado) : null;

  return (
    <Modal
      visible={abierta}
      transparent
      animationType="fade"
      onRequestClose={pedirCierre}
      accessibilityViewIsModal
    >
      <View style={estilos.fondo}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={estilos.centro}
        >
          <SafeAreaView style={[estilos.panel, esDesktop && estilos.panelDesktop]}>
            {confirmarCierre ? (
              <View style={estilos.confirmacion}>
                <Texto variante="titulo">¿Descartar la solicitud?</Texto>
                <Texto variante="cuerpo" color={colores.secundario}>
                  {incierto
                    ? 'No pudimos confirmar el envío. Si ya se guardó, aparecerá en Mis servicios; si no, puedes volver a intentarlo sin duplicar la solicitud.'
                    : 'Si cierras ahora, perderás los datos ingresados y no se enviará la solicitud.'}
                </Texto>
                <BotonPrimario
                  titulo={incierto ? 'Volver a la solicitud' : 'Seguir completando'}
                  onPress={() => setConfirmarCierre(false)}
                />
                <BotonPrimario
                  titulo={incierto ? 'Cerrar de todos modos' : 'Descartar'}
                  variante="secundario"
                  onPress={() => {
                    setConfirmarCierre(false);
                    cerrar();
                  }}
                />
              </View>
            ) : resultado ? (
              <ScrollView contentContainerStyle={estilos.confirmacion}>
                <View style={estilos.iconoExito}>
                  <Ionicons name="checkmark" size={30} color={colores.exito} />
                </View>
                <Texto variante="titulo" centrado>
                  {resultado.creada ? 'Solicitud enviada' : 'Esta solicitud ya estaba registrada'}
                </Texto>
                <View style={estilos.filaCentrada}>
                  <Chip texto={`Orden #${resultado.id}`} tono="marca" />
                  {estado ? <Chip texto={estado.texto} tono={estado.tono} /> : null}
                </View>
                <Texto variante="cuerpo" color={colores.secundario} centrado>
                  {resultado.estado === 'solicitado'
                    ? 'Tu solicitud quedó registrada. Todavía no tiene técnico asignado ni un precio final: cuando estén disponibles, aparecerán en el seguimiento de la orden.'
                    : `Tu solicitud ya existía y su estado actual es ${estado?.texto ?? resultado.estado}. Puedes ver el detalle en el seguimiento de la orden.`}
                </Texto>
                <Aviso tono="info" titulo="Seguimiento">
                  Puedes consultar el estado y la evidencia desde el listado de órdenes. No hace
                  falta volver a enviar la solicitud.
                </Aviso>
                <BotonPrimario titulo="Entendido" onPress={cerrar} />
              </ScrollView>
            ) : (
              <>
                <View style={estilos.cabecera}>
                  <View style={estilos.cabeceraTextos}>
                    <Texto variante="etiqueta" color={colores.marca}>
                      Nueva solicitud
                    </Texto>
                    <Texto variante="titulo">{PASOS[paso]}</Texto>
                    <Texto variante="caption" color={colores.secundario}>
                      Paso {paso + 1} de {PASOS.length}
                    </Texto>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar la solicitud"
                    onPress={pedirCierre}
                    disabled={ocupado}
                    hitSlop={10}
                    style={estilos.cerrar}
                  >
                    <Ionicons name="close" size={22} color={colores.secundario} />
                  </Pressable>
                </View>
                <View style={estilos.progreso}>
                  {PASOS.map((nombre, i) => (
                    <View
                      key={nombre}
                      style={[
                        estilos.progresoTramo,
                        i <= paso ? estilos.progresoActivo : null,
                      ]}
                    />
                  ))}
                </View>

                <ScrollView
                  style={estilos.scroll}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={estilos.cuerpo}
                >
                  {paso === 0 ? (
                    <>
                      <Texto variante="subtitulo">¿Qué necesitas arreglar?</Texto>
                      <Texto variante="caption" color={colores.secundario}>
                        Selecciona la categoría que mejor describa el problema.
                      </Texto>
                      {cargandoCategorias ? (
                        <ActivityIndicator color={colores.marca} />
                      ) : null}
                      {errorCategorias ? (
                        <>
                          <Aviso tono="advertencia">{errorCategorias}</Aviso>
                          <BotonPrimario
                            titulo="Reintentar"
                            variante="secundario"
                            onPress={() => setIntento((n) => n + 1)}
                          />
                        </>
                      ) : null}
                      <View style={estilos.categorias}>
                        {categorias.map((c) => {
                          const activa = borrador.categoria === c.id;
                          return (
                            <Pressable
                                key={c.id}
                                accessibilityRole="radio"
                                aria-checked={activa}
                                accessibilityState={{ checked: activa, disabled: incierto }}
                                disabled={incierto}
                              onPress={() => {
                                if (!incierto) cambiar((b) => ({ ...b, categoria: c.id }));
                              }}
                              style={[
                                estilos.categoria,
                                esDesktop && estilos.categoriaDesktop,
                                activa ? estilos.categoriaActiva : null,
                              ]}
                            >
                              <View style={estilos.categoriaIcono}>
                                <Ionicons
                                  name={iconoCategoria(c.nombre)}
                                  size={22}
                                  color={colores.marca}
                                />
                              </View>
                              <Texto variante="cuerpoFuerte">{c.nombre}</Texto>
                              <Texto variante="caption" color={colores.secundario}>
                                {c.tarifaVisita !== null
                                  ? `Visita desde ${bolivianos(c.tarifaVisita)}`
                                  : 'Tarifa a confirmar'}
                              </Texto>
                            </Pressable>
                          );
                        })}
                      </View>
                      {!cargandoCategorias && !errorCategorias && categorias.length === 0 ? (
                        <Aviso tono="advertencia">
                          No hay categorías disponibles en este momento. Intenta de nuevo más
                          tarde.
                        </Aviso>
                      ) : null}
                      {intentado && !borrador.categoria ? (
                        <Texto variante="caption" color={colores.peligro}>
                          Selecciona una categoría para continuar.
                        </Texto>
                      ) : null}
                      <Texto variante="caption" color={colores.terciario}>
                        La tarifa publicada es la visita técnica. El precio del trabajo se
                        confirma después del diagnóstico.
                      </Texto>
                    </>
                  ) : null}

                  {paso === 1 ? (
                    <>
                      <CampoTexto
                        etiqueta="Descripción del problema"
                        placeholder="Ej.: hay una fuga debajo de la cocina y el piso está mojado."
                        value={borrador.descripcion}
                        onChangeText={(v) => cambiar((b) => ({ ...b, descripcion: v }))}
                        multiline
                        numberOfLines={5}
                        maxLength={2000}
                        editable={!ocupado && !incierto}
                        error={intentado && errorDesc ? errorDesc : undefined}
                      />
                      <Texto variante="caption" color={colores.terciario}>
                        {borrador.descripcion.trim().length}/2000 caracteres
                      </Texto>

                      <Pressable
                        accessibilityRole="switch"
                        aria-checked={borrador.urgencia}
                        accessibilityState={{ checked: borrador.urgencia, disabled: incierto }}
                        disabled={incierto}
                        onPress={() => {
                          if (!incierto) cambiar((b) => ({ ...b, urgencia: !b.urgencia }));
                        }}
                        style={[estilos.urgencia, borrador.urgencia ? estilos.urgenciaActiva : null]}
                      >
                        <Ionicons
                          name="flash"
                          size={20}
                          color={borrador.urgencia ? colores.acento : colores.terciario}
                        />
                        <View style={estilos.urgenciaTexto}>
                          <Texto variante="cuerpoFuerte">Necesito atención prioritaria</Texto>
                          <Texto variante="caption" color={colores.secundario}>
                            Si corresponde un recargo, se detalla en la cotización.
                          </Texto>
                        </View>
                        <Ionicons
                          name={borrador.urgencia ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={borrador.urgencia ? colores.acento : colores.deshabilitado}
                        />
                      </Pressable>

                      <View style={estilos.evidencia}>
                        <Texto variante="etiqueta" color={colores.secundario}>
                          Evidencia (opcional)
                        </Texto>
                        {borrador.evidencia ? (
                          <View style={estilos.archivo}>
                            <Ionicons name="document-attach" size={20} color={colores.marca} />
                            <View style={estilos.archivoTexto}>
                              <Texto variante="cuerpo" numberOfLines={1}>
                                {borrador.evidencia.nombre}
                              </Texto>
                              <Texto variante="caption" color={colores.secundario}>
                                Archivo privado
                              </Texto>
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Quitar evidencia"
                              onPress={() =>
                                cambiar((b) => ({ ...b, evidencia: undefined }))
                              }
                              hitSlop={8}
                            >
                              <Ionicons name="trash-outline" size={20} color={colores.peligro} />
                            </Pressable>
                          </View>
                        ) : (
                          <BotonPrimario
                            titulo="Adjuntar foto o PDF"
                            variante="secundario"
                            onPress={() => void elegirEvidencia()}
                            deshabilitado={ocupado || incierto}
                          />
                        )}
                        {errorEvidencia ? (
                          <Texto variante="caption" color={colores.peligro}>
                            {errorEvidencia}
                          </Texto>
                        ) : null}
                        <Texto variante="caption" color={colores.terciario}>
                          JPG, PNG o PDF hasta 8 MB. Solo tú y el equipo de Fixly pueden verlo.
                        </Texto>
                      </View>
                    </>
                  ) : null}

                  {paso === 2 ? (
                    <>
                      <ElegirDireccionGuardada bloqueado={ocupado || incierto || buscandoUbicacion}
                        onElegir={d => {
                          setErrorUbicacion('');
                          setCoordenadasManuales(false);
                          cambiar(b => ({ ...b, latitud: String(d.latitud),
                            longitud: String(d.longitud), referencia: d.referencia }));
                        }} />
                      <Aviso tono="info" titulo="Tu ubicación">
                        Toca el mapa o mueve el pin hasta el lugar del servicio. También puedes usar el GPS
                        o elegir una dirección guardada. El punto inicial solo centra el mapa; no se guarda
                        hasta que lo selecciones.
                      </Aviso>
                      {abierta ? <Mapa destino={puntoMapa} onSeleccionar={seleccionarUbicacion}
                        etiquetaPunto={ubicacionElegida ? 'Ubicación del servicio' : 'Selecciona el lugar del servicio'}
                        alto={320} /> : null}
                      {ubicacionElegida ? <Texto variante="caption">
                        Ubicación marcada: {lat.toFixed(6)}, {lng.toFixed(6)}.
                      </Texto> : null}
                      {intentado && !ubicacionElegida ? <Aviso tono="advertencia">
                        Marca el punto del servicio en el mapa o usa tu ubicación actual para continuar.
                      </Aviso> : null}
                      <BotonPrimario
                        titulo={buscandoUbicacion ? 'Buscando ubicación…' : 'Usar mi ubicación'}
                        variante="secundario"
                        onPress={() => void usarUbicacion()}
                        cargando={buscandoUbicacion}
                        deshabilitado={ocupado || incierto || buscandoUbicacion}
                      />
                      {errorUbicacion ? (
                        <Aviso tono="advertencia">{errorUbicacion}</Aviso>
                      ) : null}
                      <Texto color={colores.marca} variante="etiqueta" accessibilityRole="button"
                        onPress={() => setCoordenadasManuales(v => !v)}>
                        {coordenadasManuales ? 'Ocultar coordenadas manuales' : 'Ingresar coordenadas manualmente'}
                      </Texto>
                      {coordenadasManuales ? <View style={[estilos.fila, esDesktop && estilos.filaDesktop]}>
                        <View style={estilos.mitad}>
                          <CampoTexto etiqueta="Latitud" placeholder="-16.500000" value={borrador.latitud}
                            onChangeText={(v) => cambiar((b) => ({ ...b, latitud: v.replace(',', '.') }))}
                            keyboardType="decimal-pad" inputMode="decimal" maxLength={20} editable={!ocupado && !incierto}
                            error={intentado && errorLat ? errorLat : undefined} />
                        </View>
                        <View style={estilos.mitad}>
                          <CampoTexto etiqueta="Longitud" placeholder="-68.150000" value={borrador.longitud}
                            onChangeText={(v) => cambiar((b) => ({ ...b, longitud: v.replace(',', '.') }))}
                            keyboardType="decimal-pad" inputMode="decimal" maxLength={20} editable={!ocupado && !incierto}
                            error={intentado && errorLng ? errorLng : undefined} />
                        </View>
                      </View> : null}
                      <CampoTexto
                        etiqueta="Dirección o referencia"
                        placeholder="Calle, número, color de la puerta, entre calles…"
                        value={borrador.referencia}
                        onChangeText={(v) => cambiar((b) => ({ ...b, referencia: v }))}
                        maxLength={300}
                        editable={!ocupado && !incierto}
                        error={intentado && errorRef ? errorRef : undefined}
                      />
                      <Texto variante="caption" color={colores.terciario}>
                        Solo la ven el técnico asignado y el equipo de Fixly.
                      </Texto>
                    </>
                  ) : null}

                  {paso === 3 ? (
                    <>
                      <Aviso titulo="Antes de enviar">
                        Revisa que la categoría corresponda a la falla, confirma el punto de atención y
                        agrega una foto si ayuda a entender el problema. No compartas contraseñas ni documentos personales.
                        La solicitud no confirma un técnico, un precio final ni una hora de llegada.
                      </Aviso>
                      <Texto variante="subtitulo">Revisa tu solicitud</Texto>
                      <View style={estilos.resumen}>
                        <Dato etiqueta="Categoría" valor={categoriaElegida?.nombre ?? '—'} />
                        <Dato etiqueta="Descripción" valor={borrador.descripcion.trim()} />
                        <Dato etiqueta="Urgencia" valor={borrador.urgencia ? 'Sí' : 'No'} />
                        <Dato etiqueta="Dirección" valor={borrador.referencia.trim()} />
                        <Dato
                          etiqueta="Coordenadas"
                          valor={
                            lat !== null && lng !== null
                              ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
                              : '—'
                          }
                        />
                        <Dato
                          etiqueta="Evidencia"
                          valor={borrador.evidencia?.nombre ?? 'Sin archivo adjunto'}
                        />
                      </View>
                      <Aviso tono="info" titulo="Qué pasa al enviar">
                        La orden queda en estado Solicitado. Todavía no hay técnico asignado ni
                        precio final; cuando existan, los vas a ver en el seguimiento.
                      </Aviso>
                      {error ? (
                        <Aviso tono={incierto ? 'advertencia' : 'peligro'}>
                          {error}
                          {incierto
                            ? ' Reintenta con el mismo botón: la solicitud no se duplica.'
                            : ''}
                        </Aviso>
                      ) : null}
                    </>
                  ) : null}
                </ScrollView>

                <View style={[estilos.pie, esDesktop && estilos.pieDesktop]}>
                  {paso > 0 && !incierto ? (
                    <BotonPrimario
                      titulo="Atrás"
                      variante="secundario"
                      onPress={() => ir(paso - 1)}
                      deshabilitado={ocupado}
                    />
                  ) : null}
                  <View style={estilos.piePrincipal}>
                    <BotonPrimario
                      titulo={
                        paso < PASOS.length - 1
                          ? 'Continuar'
                          : incierto
                            ? 'Reintentar envío'
                            : 'Enviar solicitud'
                      }
                      onPress={avanzar}
                      cargando={ocupado}
                    />
                  </View>
                </View>
              </>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato}>
      <Texto variante="caption" color={colores.secundario}>
        {etiqueta}
      </Texto>
      <Texto variante="cuerpo">{valor}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(16,24,40,0.45)',
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    flex: 1,
    width: '100%',
    backgroundColor: colores.superficie,
  },
  panelDesktop: {
    // Evitar flex-basis: 0% en web: debe respetar la altura relativa del panel.
    flex: undefined,
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    width: 640,
    height: '85%',
    maxHeight: 760,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio.md,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.lg,
    paddingBottom: espacio.md,
  },
  cabeceraTextos: {
    flex: 1,
    gap: 2,
  },
  cerrar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.fondo,
  },
  progreso: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: espacio.lg,
  },
  progresoTramo: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.linea,
  },
  progresoActivo: {
    backgroundColor: colores.marca,
  },
  cuerpo: {
    padding: espacio.lg,
    gap: espacio.base,
  },
  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.md,
  },
  categoria: {
    width: '47%',
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: radio.control,
    padding: espacio.base,
    gap: 4,
    backgroundColor: colores.superficie,
  },
  categoriaDesktop: {
    width: '31%',
  },
  categoriaActiva: {
    borderColor: colores.marca,
    backgroundColor: colores.marcaSuave,
  },
  categoriaIcono: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.marcaSuave,
    marginBottom: 6,
  },
  urgencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    padding: espacio.base,
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: radio.control,
  },
  urgenciaActiva: {
    borderColor: colores.acento,
    backgroundColor: colores.acentoSuave,
  },
  urgenciaTexto: {
    flex: 1,
    gap: 2,
  },
  evidencia: {
    gap: espacio.sm,
  },
  archivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    padding: espacio.md,
    borderRadius: radio.control,
    borderWidth: 1,
    borderColor: colores.linea,
    backgroundColor: colores.fondo,
  },
  archivoTexto: {
    flex: 1,
    gap: 2,
  },
  fila: {
    gap: espacio.md,
  },
  filaDesktop: {
    flexDirection: 'row',
  },
  mitad: {
    flex: 1,
  },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  resumen: {
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: radio.control,
    overflow: 'hidden',
  },
  dato: {
    paddingHorizontal: espacio.base,
    paddingVertical: espacio.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.linea,
    gap: 2,
  },
  pie: {
    padding: espacio.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
    gap: espacio.sm,
  },
  pieDesktop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  piePrincipal: {
    flexGrow: 1,
    maxWidth: 320,
    alignSelf: 'stretch',
  },
  confirmacion: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: espacio.lg,
    gap: espacio.base,
  },
  iconoExito: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.exitoSuave,
  },
  filaCentrada: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: espacio.sm,
    flexWrap: 'wrap',
  },
});

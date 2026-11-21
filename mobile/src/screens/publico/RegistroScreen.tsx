import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';
import { useResponsive } from '../../theme/responsive';
import { colores, espacio, radio, sombraTarjeta } from '../../theme/tokens';
import { TipoCliente } from '../../domain/models/Sesion';
import { ErrorApi } from '../../infrastructure/http/errores';
import { useSesion } from '../../session/SesionProvider';
import { MarcoPublico } from './MarcoPublico';
import { AccesoGoogle } from '../auth/AccesoGoogle';

export interface RegistroScreenProps {
  tecnico?: boolean;
  tipoCliente: TipoCliente;
  /** Vuelve al selector de tipo de cuenta. */
  onVolver: () => void;
  onEntrar: () => void;
}

type Paso = 1 | 2;
type Errores = Record<string, string>;

const CAMPOS_PASO_1 = ['nombre', 'apellido', 'razonSocial', 'nit', 'email', 'telefono'];

/**
 * Registro público de clientes en dos pasos: datos y seguridad.
 *
 * No se pide todo de golpe: primero la identidad mínima y después la
 * contraseña. La cuenta de empresa agrega razón social y NIT porque la factura
 * va a su nombre. El registro técnico tiene un propósito propio en el servidor.
 */
export function RegistroScreen({ tipoCliente, tecnico = false, onVolver, onEntrar }: RegistroScreenProps) {
  const { esDesktop } = useResponsive();
  const { registrar, registrarTecnico } = useSesion();
  const esEmpresa = tipoCliente === 'empresa';

  const [paso, setPaso] = useState<Paso>(1);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nit, setNit] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [googleOcupado, setGoogleOcupado] = useState(false);
  const envioEnCurso = useRef(false);

  // El botón atrás de Android retrocede un paso del asistente, no pierde todo.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      if (googleOcupado || enviando) return true;
      if (paso === 2) {
        setPaso(1);
        setErrorGeneral(null);
      } else {
        onVolver();
      }
      return true;
    });
    return () => suscripcion.remove();
  }, [paso, onVolver, googleOcupado, enviando]);

  function limpiarError(campo: string) {
    setErrores((previos) => {
      if (!previos[campo]) return previos;
      const copia = { ...previos };
      delete copia[campo];
      return copia;
    });
  }

  function validarPaso1(): Errores {
    const nuevos: Errores = {};
    if (!nombre.trim()) {
      nuevos.nombre = esEmpresa
        ? 'Escribe el nombre del responsable.'
        : 'Escribe tu nombre.';
    }
    if (!apellido.trim()) {
      nuevos.apellido = esEmpresa
        ? 'Escribe el apellido del responsable.'
        : 'Escribe tu apellido.';
    }
    if (esEmpresa) {
      if (!razonSocial.trim()) nuevos.razonSocial = 'Escribe la razón social.';
      if (!nit.trim()) nuevos.nit = 'Escribe el NIT de la empresa.';
    }
    if (!email.trim()) {
      nuevos.email = 'Escribe tu correo electrónico.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nuevos.email = 'Ingresa un correo electrónico válido.';
    }
    if (telefono.trim() && !/^[0-9+\-\s()]{7,20}$/.test(telefono.trim())) {
      nuevos.telefono = 'Ingresa un teléfono válido (7 a 20 caracteres).';
    }
    return nuevos;
  }

  function validarPaso2(): Errores {
    const nuevos: Errores = {};
    if (password.length < 8) {
      nuevos.password = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (password.length > 72) {
      nuevos.password = 'La contraseña no puede superar 72 caracteres.';
    }
    if (!confirmacion) {
      nuevos.confirmacion = 'Repite la contraseña.';
    } else if (confirmacion !== password) {
      nuevos.confirmacion = 'Las contraseñas no coinciden.';
    }
    return nuevos;
  }

  function continuar() {
    if (googleOcupado || enviando) return;
    Keyboard.dismiss();
    setErrorGeneral(null);
    const nuevos = validarPaso1();
    setErrores(nuevos);
    if (Object.keys(nuevos).length === 0) {
      setPaso(2);
    }
  }

  function volver() {
    if (googleOcupado || enviando) return;
    Keyboard.dismiss();
    setErrorGeneral(null);
    if (paso === 2) {
      setPaso(1);
      return;
    }
    onVolver();
  }

  async function enviar() {
    if (envioEnCurso.current || googleOcupado) return;
    Keyboard.dismiss();
    setErrorGeneral(null);
    const nuevos = validarPaso2();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    envioEnCurso.current = true;
    setEnviando(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        telefono: telefono.trim() || undefined,
        password,
        tipoCliente,
        razonSocial: esEmpresa ? razonSocial.trim() : undefined,
        nit: esEmpresa ? nit.trim() : undefined,
      };
      if (tecnico) await registrarTecnico(datos);
      else await registrar(datos);
      // La sesión queda iniciada y RootNavigator cambia solo de shell.
    } catch (e) {
      const error = e as ErrorApi;
      setEnviando(false);

      if (error.campos?.length > 0) {
        const porCampo: Errores = {};
        error.campos.forEach((campo) => {
          porCampo[campo.campo] = campo.mensaje;
        });
        setErrores(porCampo);
        if (CAMPOS_PASO_1.some((campo) => porCampo[campo])) {
          setPaso(1);
        }
        return;
      }

      if (error.codigo === 'EMAIL_YA_REGISTRADO') {
        setErrores({ email: error.message });
        setPaso(1);
      } else if (error.codigo === 'NIT_YA_REGISTRADO') {
        setErrores({ nit: error.message });
        setPaso(1);
      } else if (error.codigo === 'DATOS_EMPRESA_INCOMPLETOS') {
        setErrores({
          razonSocial: 'Completa la razón social.',
          nit: 'Completa el NIT.',
        });
        setPaso(1);
      } else {
        setErrorGeneral(error.message || 'No pudimos crear tu cuenta. Intenta de nuevo.');
      }
    } finally {
      envioEnCurso.current = false;
      setEnviando(false);
    }
  }

  const titulo =
    paso === 1
      ? esEmpresa
        ? 'Datos de la empresa'
        : tecnico ? 'Tu cuenta de técnico' : 'Tus datos'
      : 'Crea tu contraseña';

  const subtitulo =
    paso === 1
      ? esEmpresa
        ? 'La factura va a nombre de tu empresa. El responsable es quien usa la cuenta.'
        : 'Así te contactamos cuando pidas un servicio.'
      : 'Con esta contraseña ingresas a Fixly y consultas el estado de tu cuenta.';

  return (
    <MarcoPublico
      onVolver={volver}
      volverTexto={paso === 2 ? 'Volver a tus datos' : 'Volver'}
      destacados={
        esDesktop
          ? [
              'Precio estimado antes de confirmar',
              'Revisión de identidad y certificados',
              'Seguimiento del servicio en la app',
            ]
          : undefined
      }
    >
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={estilos.teclado}
        >
          <ScrollView
            contentContainerStyle={[
              estilos.scroll,
              esDesktop ? estilos.scrollEscritorio : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={[estilos.caja, esDesktop ? estilos.cajaEscritorio : null]}>
              <View style={estilos.header}>
                <Pressable
                  accessibilityRole="button"
                  onPress={volver}
                  style={estilos.volver}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={18} color={colores.secundario} />
                  <Texto variante="etiqueta" color={colores.secundario}>
                    Volver
                  </Texto>
                </Pressable>
                <Texto variante="caption" color={colores.terciario}>
                  Paso {paso} de 2
                </Texto>
              </View>

              <View style={estilos.progreso}>
                <View style={[estilos.segmento, estilos.segmentoActivo]} />
                <View
                  style={[estilos.segmento, paso === 2 ? estilos.segmentoActivo : null]}
                />
              </View>

              <View style={estilos.encabezado}>
                <Texto variante="titulo">{titulo}</Texto>
                <Texto variante="cuerpo" color={colores.secundario}>
                  {subtitulo}
                </Texto>
              </View>

              {errorGeneral ? (
                <Texto variante="caption" color={colores.peligro}>
                  {errorGeneral}
                </Texto>
              ) : null}

              {paso === 1 ? (
                <View style={estilos.formulario}>
                  {!esEmpresa ? <AccesoGoogle proposito={tecnico ? 'tecnico' : 'cliente'}
                    deshabilitado={enviando} onInteraccion={setGoogleOcupado} /> : null}
                  {esEmpresa ? (
                    <>
                      <CampoTexto
                        etiqueta="Razón social"
                        value={razonSocial}
                        onChangeText={(v) => {
                          setRazonSocial(v);
                          limpiarError('razonSocial');
                        }}
                        error={errores.razonSocial}
                        autoCapitalize="words"
                        autoComplete="organization"
                        placeholder="Ferretería La Paz S.R.L."
                      />
                      <CampoTexto
                        etiqueta="NIT"
                        value={nit}
                        onChangeText={(v) => {
                          setNit(v);
                          limpiarError('nit');
                        }}
                        error={errores.nit}
                        keyboardType="number-pad"
                        maxLength={20}
                        placeholder="1234567021"
                      />
                      <Texto variante="etiqueta" color={colores.secundario}>
                        Responsable de la cuenta
                      </Texto>
                    </>
                  ) : null}

                  <CampoTexto
                    etiqueta={esEmpresa ? 'Nombre del responsable' : 'Nombre'}
                    value={nombre}
                    onChangeText={(v) => {
                      setNombre(v);
                      limpiarError('nombre');
                    }}
                    error={errores.nombre}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                  />
                  <CampoTexto
                    etiqueta={esEmpresa ? 'Apellido del responsable' : 'Apellido'}
                    value={apellido}
                    onChangeText={(v) => {
                      setApellido(v);
                      limpiarError('apellido');
                    }}
                    error={errores.apellido}
                    autoCapitalize="words"
                  />
                  <CampoTexto
                    etiqueta="Email"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      limpiarError('email');
                    }}
                    error={errores.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                  <CampoTexto
                    etiqueta="Teléfono (opcional)"
                    value={telefono}
                    onChangeText={(v) => {
                      setTelefono(v);
                      limpiarError('telefono');
                    }}
                    error={errores.telefono}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    placeholder="71234567"
                  />
                </View>
              ) : (
                <View style={estilos.formulario}>
                  <CampoTexto
                    etiqueta="Contraseña"
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      limpiarError('password');
                    }}
                    error={errores.password}
                    esPassword
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                  <CampoTexto
                    etiqueta="Repite la contraseña"
                    value={confirmacion}
                    onChangeText={(v) => {
                      setConfirmacion(v);
                      limpiarError('confirmacion');
                    }}
                    error={errores.confirmacion}
                    esPassword
                    autoComplete="new-password"
                    textContentType="newPassword"
                    onSubmitEditing={enviar}
                  />

                  <View style={estilos.requisitos}>
                    <Requisito
                      cumplido={password.length >= 8}
                      texto="Al menos 8 caracteres"
                    />
                    <Requisito
                      cumplido={password.length > 0 && password.length <= 72}
                      texto="Máximo 72 caracteres"
                    />
                    <Requisito
                      cumplido={confirmacion.length > 0 && confirmacion === password}
                      texto="Las contraseñas coinciden"
                    />
                  </View>
                </View>
              )}

              <View style={estilos.acciones}>
                {paso === 1 ? (
                  <BotonPrimario titulo="Continuar" deshabilitado={googleOcupado} onPress={continuar} />
                ) : (
                  <BotonPrimario
                    titulo="Crear cuenta"
                    onPress={enviar}
                    cargando={enviando}
                  />
                )}
                <Texto variante="caption" color={colores.terciario} centrado>
                  {tecnico ? 'Tu cuenta es el primer paso. Revisaremos tu CI y certificados antes de habilitarte para trabajar.' : 'Tu cuenta te permite gestionar servicios en Fixly Bolivia.'}
                </Texto>
              </View>

              <View style={estilos.pie}>
                <Texto variante="caption" color={colores.secundario}>
                  ¿Ya tienes cuenta?
                </Texto>
                <Texto
                  variante="etiqueta"
                  color={colores.marca}
                  onPress={onEntrar}
                  accessibilityRole="button"
                >
                  Iniciar sesión
                </Texto>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MarcoPublico>
  );
}

function Requisito({ cumplido, texto }: { cumplido: boolean; texto: string }) {
  return (
    <View style={estilos.requisito}>
      <Ionicons
        name={cumplido ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={cumplido ? colores.exito : colores.deshabilitado}
      />
      <Texto variante="caption" color={cumplido ? colores.exito : colores.secundario}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  seguro: {
    flex: 1,
  },
  teclado: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.base,
    paddingBottom: espacio.xl,
  },
  scrollEscritorio: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: espacio.xl,
    paddingBottom: espacio.xl,
  },
  caja: {
    width: '100%',
    maxWidth: 520,
    gap: espacio.base,
  },
  cajaEscritorio: {
    // La tarjeta debe medir su contenido, no flex-basis: 0% en React Native Web.
    flexShrink: 0,
    width: '100%',
    maxWidth: 560,
    backgroundColor: colores.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.xl,
    ...sombraTarjeta,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progreso: {
    flexDirection: 'row',
    gap: 6,
  },
  segmento: {
    flex: 1,
    height: 4,
    borderRadius: radio.chip,
    backgroundColor: colores.linea,
  },
  segmentoActivo: {
    backgroundColor: colores.marca,
  },
  encabezado: {
    gap: espacio.sm,
  },
  formulario: {
    gap: espacio.base,
  },
  requisitos: {
    gap: 6,
    marginTop: -espacio.xs,
  },
  requisito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acciones: {
    gap: espacio.md,
    marginTop: espacio.sm,
  },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});

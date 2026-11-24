import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { SesionGps } from '../domain/models/Operacion';
import { operacionRepository } from '../infrastructure/di';
import { apiClient } from '../infrastructure/http/apiClient';
import { cerrarSesionGps, enviarMuestraGps, ErrorGps } from '../infrastructure/ubicacion/gpsTransporte';
import { iniciarSegundoPlano, detenerSegundoPlano, recuperarSegundoPlano } from '../infrastructure/ubicacion/gpsSegundoPlano';
import { registrarCierre } from './cierreRecursos';
import { useSesion } from './SesionProvider';
import { Texto } from '../ui/Texto';
import { BotonPrimario } from '../ui/BotonPrimario';
import { colores } from '../theme/tokens';

interface ContextoGps {
  sesion: SesionGps | null; ocupado: boolean; mensaje: string; ultimoEnvio: string | null;
  iniciar: (orden: number, segundo?: boolean) => Promise<void>; detener: () => Promise<void>;
}
const Contexto = createContext<ContextoGps | null>(null);
export function useSeguimientoGps() {
  const c = useContext(Contexto);
  if (!c) throw new Error('El seguimiento solo está disponible en la sesión técnica.');
  return c;
}

/** Un emisor por cuenta, no uno por pantalla. Nunca solicita permisos al montarse. */
export function SeguimientoGpsProvider({ children }: { children: ReactNode }) {
  const { usuario, cerrarSesion } = useSesion();
  const [sesion, setSesion] = useState<SesionGps | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [ultimoEnvio, setUltimoEnvio] = useState<string | null>(null);
  const actual = useRef<{ datos: SesionGps; autorizacion: string } | null>(null);
  const observador = useRef<Location.LocationSubscription | null>(null);
  const generacion = useRef(0);
  const iniciando = useRef(false);
  const enviando = useRef(false);
  const ultimaPeticion = useRef(0);
  const detener = useCallback(async () => {
    const anterior = actual.current;
    // Sin sesión activa ni inicio en curso no hay nada que invalidar: un
    // detener espurio (montaje, limpieza, doble toque) no debe cancelar un
    // inicio que está por arrancar.
    if (!anterior && !iniciando.current) { setSesion(null); setUltimoEnvio(null); return; }
    ++generacion.current;
    actual.current = null;
    observador.current?.remove(); observador.current = null;
    setSesion(null); setUltimoEnvio(null); setMensaje('Ubicación compartida detenida.');
    if (anterior?.datos.segundoPlano) await detenerSegundoPlano(anterior.datos.sesion);
    if (anterior) await cerrarSesionGps(anterior.datos, anterior.autorizacion);
  }, []);
  useEffect(() => registrarCierre(detener), [detener]);
  useEffect(() => {
    let vigente = true;
    const turno = generacion.current;
    void recuperarSegundoPlano(usuario!.id).then(s => {
      if (vigente && turno === generacion.current && s) {
        actual.current = { datos: s, autorizacion: String(apiClient.defaults.headers.common.Authorization ?? '') };
        setSesion(s); setMensaje('Seguimiento nativo previamente autorizado activo.');
      }
    }).catch(() => setMensaje('No pudimos recuperar el estado GPS. Actívalo de nuevo si lo necesitas.'));
    return () => { vigente = false; void detener(); };
  }, [usuario?.id, detener]);
  useEffect(() => {
    const cambio = () => {
      const visible = Platform.OS === 'web' ? !document.hidden : AppState.currentState === 'active';
      if (!visible && actual.current && !actual.current.datos.segundoPlano) void detener();
    };
    const sub = AppState.addEventListener('change', cambio);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', cambio);
    return () => { sub.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', cambio); };
  }, [detener]);
  useEffect(() => {
    if (!sesion) return;
    let vigente = true, consulta = false;
    const revisar = async () => {
      if (consulta || AppState.currentState !== 'active') return;
      consulta = true;
      try {
        const d = await operacionRepository.detalle(sesion.orden);
        if (vigente && (d.estado !== 'en_camino' || Date.parse(sesion.expiraEn) <= Date.now())) await detener();
        if (vigente && sesion.segundoPlano && !await recuperarSegundoPlano(usuario!.id)) await detener();
      } catch { if (vigente) setMensaje('No pudimos validar el servicio. El servidor controla la vigencia de cada reporte.'); }
      finally { consulta = false; }
    };
    const t = setInterval(() => void revisar(), 10000);
    return () => { vigente = false; clearInterval(t); };
  }, [sesion, usuario?.id, detener]);

  async function iniciar(orden: number, segundo = false) {
    if (iniciando.current) return;
    iniciando.current = true; setOcupado(true);
    await detener();
    const turno = ++generacion.current;
    const autorizacion = String(apiClient.defaults.headers.common.Authorization ?? '');
    try {
      if (Platform.OS === 'web' && !window.isSecureContext)
        throw new Error('El GPS web necesita HTTPS o localhost. No se puede activar desde este origen.');
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (turno !== generacion.current) return;
      if (!permiso.granted) throw new Error('No autorizaste la ubicación. Puedes intentar otra vez desde los permisos del dispositivo.');
      if (segundo && (Platform.OS === 'web' || process.env.EXPO_PUBLIC_GPS_SEGUNDO_PLANO !== 'true'))
        throw new Error('El segundo plano requiere un development build configurado.');
      const datos = await operacionRepository.iniciarGps(orden, Platform.OS, segundo);
      if (turno !== generacion.current) { await cerrarSesionGps(datos, autorizacion); return; }
      actual.current = { datos, autorizacion }; setSesion(datos); ultimaPeticion.current = 0;
      if (segundo) {
        await iniciarSegundoPlano(datos, usuario!.id, autorizacion, () => turno === generacion.current);
        if (turno !== generacion.current) { await detenerSegundoPlano(datos.sesion); return; }
        setMensaje('Segundo plano autorizado. El sistema puede interrumpirlo; no se garantiza señal continua.');
        return;
      }
      setMensaje('GPS activo. Esperando una posición reciente con buena precisión.');
      const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
        p => {
          if (turno !== generacion.current || enviando.current) return;
          if (!Number.isFinite(p.timestamp) || Date.now() - p.timestamp > 30000 || p.timestamp > Date.now() + 5000
            || p.coords.accuracy == null || p.coords.accuracy < 0 || p.coords.accuracy > 200) {
            setMensaje('Señal insuficiente. Esperando una posición reciente con precisión de hasta 200 m.'); return;
          }
          if (Date.now() - ultimaPeticion.current < 5000) return;
          ultimaPeticion.current = Date.now(); enviando.current = true;
          void enviarMuestraGps(datos, { latitud: p.coords.latitude, longitud: p.coords.longitude,
            precision: p.coords.accuracy, capturadoEn: new Date(p.timestamp).toISOString() }, autorizacion)
            .then(() => { if (turno === generacion.current) {
              setUltimoEnvio(new Date(p.timestamp).toISOString()); setMensaje('Compartiendo ubicación con tu cliente.');
            } })
            .catch(async e => {
              if (turno !== generacion.current) return;
              if (e instanceof ErrorGps && e.estado < 500) {
                await detener(); setMensaje(e.message);
                if (e.estado === 401) await cerrarSesion();
              } else setMensaje('Sin conexión. No se enviarán posiciones atrasadas cuando vuelva la red.');
            }).finally(() => { enviando.current = false; });
        }, () => { if (turno === generacion.current) setMensaje('GPS sin señal o permiso revocado. Revisa el permiso de ubicación.'); });
      if (turno !== generacion.current) sub.remove();
      else observador.current = sub;
    } catch (e) {
      if (turno === generacion.current) { await detener(); setMensaje(e instanceof Error ? e.message : 'No pudimos activar el GPS.'); }
    } finally { iniciando.current = false; setOcupado(false); }
  }
  return <Contexto.Provider value={{ sesion, ocupado, mensaje, ultimoEnvio, iniciar, detener }}>
    <View style={{ flex: 1 }}>
      {sesion ? <View style={{ padding: 12, gap: 8, backgroundColor: colores.fondo }}>
        <Texto variante="cuerpoFuerte">Ubicación compartida · Servicio #{sesion.orden}</Texto>
        <Texto variante="caption">{sesion.segundoPlano ? 'Segundo plano autorizado' : 'Solo mientras la app esté visible'}</Texto>
        <BotonPrimario titulo="Detener ubicación compartida" variante="secundario" onPress={() => void detener()} />
      </View> : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  </Contexto.Provider>;
}

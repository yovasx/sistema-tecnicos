import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { hogarRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';

interface PosicionCliente {
  latitud: number;
  longitud: number;
  capturadoEn: string;
}

export function useCompartirUbicacion(orden: number, activo: boolean) {
  const [compartiendo, setCompartiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [posicion, setPosicion] = useState<PosicionCliente | null>(null);
  const sesion = useRef<string | null>(null);
  const observador = useRef<Location.LocationSubscription | null>(null);
  const generacion = useRef(0);
  const iniciando = useRef(false);
  const enviando = useRef(false);
  const ultimaPeticion = useRef(0);
  const activoActual = useRef(activo);
  activoActual.current = activo;

  const detener = useCallback(async () => {
    if (!sesion.current && !iniciando.current) return;
    ++generacion.current;
    const anterior = sesion.current;
    sesion.current = null;
    observador.current?.remove();
    observador.current = null;
    setCompartiendo(false);
    setPosicion(null);
    setMensaje('Ubicación compartida detenida.');
    if (!anterior) return;
    try {
      await hogarRepository.detenerGpsCliente(anterior);
    } catch {
      setMensaje('El GPS se detuvo en este dispositivo, pero no se pudo confirmar el cierre con el servidor.');
    }
  }, []);

  useEffect(() => {
    if (!activo) void detener();
  }, [activo, detener]);
  useEffect(() => () => { void detener(); }, [detener]);
  useEffect(() => {
    if (!posicion) return;
    const restante = Math.max(0, Date.parse(posicion.capturadoEn) + 30000 - Date.now());
    const temporizador = setTimeout(() => setPosicion(null), restante);
    return () => clearTimeout(temporizador);
  }, [posicion]);

  const iniciar = useCallback(async () => {
    if (iniciando.current || sesion.current) return;
    iniciando.current = true;
    setOcupado(true);
    const turno = ++generacion.current;
    try {
      if (!activoActual.current) throw new Error('Abre el seguimiento para compartir tu ubicación.');
      if (Platform.OS === 'web' && !window.isSecureContext)
        throw new Error('El GPS web necesita HTTPS o localhost.');
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (turno !== generacion.current) return;
      if (!permiso.granted) throw new Error('No autorizaste la ubicación. Puedes continuar sin compartirla.');
      const datos = await hogarRepository.iniciarGpsCliente(orden, Platform.OS);
      if (turno !== generacion.current || !activoActual.current) {
        await hogarRepository.detenerGpsCliente(datos.sesion);
        return;
      }
      sesion.current = datos.sesion;
      setCompartiendo(true);
      setMensaje('Compartiendo tu ubicación actual con el técnico asignado. Solo mientras esta pantalla está visible.');
      ultimaPeticion.current = 0;
      const sub = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 5000,
      }, p => {
        if (turno !== generacion.current || enviando.current) return;
        if (!Number.isFinite(p.timestamp) || Date.now() - p.timestamp > 30000
          || p.timestamp > Date.now() + 5000 || p.coords.accuracy == null
          || p.coords.accuracy < 0 || p.coords.accuracy > 200) {
          setMensaje('Esperando una posición reciente con precisión de hasta 200 m.');
          return;
        }
        if (Date.now() - ultimaPeticion.current < 5000) return;
        ultimaPeticion.current = Date.now();
        enviando.current = true;
        void hogarRepository.enviarGpsCliente(datos.sesion, {
          latitud: p.coords.latitude,
          longitud: p.coords.longitude,
          precision: p.coords.accuracy,
          capturadoEn: new Date(p.timestamp).toISOString(),
        }).then(() => {
          if (turno === generacion.current) {
            setPosicion({ latitud: p.coords.latitude, longitud: p.coords.longitude,
              capturadoEn: new Date(p.timestamp).toISOString() });
            setMensaje('Tu ubicación está visible para el técnico asignado.');
          }
        }).catch(async e => {
          if (turno !== generacion.current) return;
          if (e instanceof ErrorApi && e.estado != null && e.estado < 500) {
            await detener();
            setMensaje(e.message);
          } else {
            setPosicion(null);
            setMensaje('Sin conexión. No se enviarán ubicaciones atrasadas cuando vuelva la red.');
          }
        }).finally(() => { enviando.current = false; });
      }, () => {
        if (turno === generacion.current) {
          setPosicion(null);
          setMensaje('GPS sin señal o permiso revocado. Revisa el permiso de ubicación.');
        }
      });
      if (turno !== generacion.current || !activoActual.current) {
        sub.remove();
        await hogarRepository.detenerGpsCliente(datos.sesion);
      } else {
        observador.current = sub;
      }
    } catch (e) {
      if (turno === generacion.current) {
        await detener();
        setMensaje(e instanceof Error ? e.message : 'No pudimos activar el GPS.');
      }
    } finally {
      iniciando.current = false;
      setOcupado(false);
    }
  }, [detener, orden]);

  return { compartiendo, ocupado, mensaje, posicion, iniciar, detener };
}

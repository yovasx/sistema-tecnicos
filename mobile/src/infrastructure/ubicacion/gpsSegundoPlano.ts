import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { SesionGps } from '../../domain/models/Operacion';
import { SecureTokenStorage } from '../storage/SecureTokenStorage';
import { enviarMuestraGps, cerrarSesionGps, ErrorGps } from './gpsTransporte';
import { registrarCierre } from '../../session/cierreRecursos';

const TAREA = 'fixly-seguimiento-servicio';
const CLAVE = 'fixly_gps_sesion';
// SecureStore, nunca localStorage ni archivos: sin coordenadas persistidas.
interface Guardada { sesion: SesionGps; usuario: number; credencial: string }
const tokens = new SecureTokenStorage();
let enviando = false;
let cola: Promise<void> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = cola.then(fn, fn);
  cola = resultado.then(() => {}, () => {});
  return resultado;
}

async function detenerInterno(sesionEsperada?: string) {
  if (sesionEsperada) {
    const valor = await SecureStore.getItemAsync(CLAVE);
    if (valor) {
      try { if ((JSON.parse(valor) as Guardada).sesion.sesion !== sesionEsperada) return; }
      catch { /* Un consentimiento ilegible no autoriza captura. */ }
    }
  }
  await SecureStore.deleteItemAsync(CLAVE);
  if (await TaskManager.isAvailableAsync() && await Location.hasStartedLocationUpdatesAsync(TAREA))
    await Location.stopLocationUpdatesAsync(TAREA);
}
export async function detenerSegundoPlano(sesionEsperada?: string) {
  return serial(() => detenerInterno(sesionEsperada));
}
registrarCierre(async () => {
  const anterior = await serial(async () => {
    const valor = await SecureStore.getItemAsync(CLAVE);
    await detenerInterno();
    return valor ? JSON.parse(valor) as Guardada : null;
  });
  if (anterior) await cerrarSesionGps(anterior.sesion, `Bearer ${anterior.credencial}`);
});
if (!TaskManager.isTaskDefined(TAREA)) TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREA, async ({ data, error }) => {
  if (enviando) return;
  enviando = true;
  let sesionEnviada: string | undefined;
  try {
    if (process.env.EXPO_PUBLIC_GPS_SEGUNDO_PLANO !== 'true') { await detenerSegundoPlano(); return; }
    const valor = await SecureStore.getItemAsync(CLAVE);
    const token = await tokens.get();
    if (error || !valor || !token) { await detenerSegundoPlano(); return; }
    const guardada = JSON.parse(valor) as Guardada;
    sesionEnviada = guardada.sesion.sesion;
    // Cambiar de cuenta/token no reutiliza un consentimiento anterior.
    if (guardada.credencial !== token || Date.parse(guardada.sesion.expiraEn) <= Date.now()) {
      await detenerSegundoPlano(); return;
    }
    const p = data?.locations?.reduce<Location.LocationObject | undefined>((a, b) => !a || b.timestamp > a.timestamp ? b : a, undefined);
    if (!p || Date.now() - p.timestamp > 30000 || p.timestamp > Date.now() + 5000
      || !Number.isFinite(p.timestamp) || p.coords.accuracy == null || p.coords.accuracy < 0 || p.coords.accuracy > 200) return;
    await enviarMuestraGps(guardada.sesion, { latitud: p.coords.latitude, longitud: p.coords.longitude,
      precision: p.coords.accuracy, capturadoEn: new Date(p.timestamp).toISOString() }, `Bearer ${token}`);
  } catch (e) {
    if (e instanceof ErrorGps && e.estado < 500) await detenerSegundoPlano(sesionEnviada);
    // Sin red: no acumular ni enviar un recorrido atrasado al reconectar.
  } finally { enviando = false; }
});

export async function iniciarSegundoPlano(sesion: SesionGps, usuario: number, autorizacion: string, vigente: () => boolean) {
  if (process.env.EXPO_PUBLIC_GPS_SEGUNDO_PLANO !== 'true' || !await TaskManager.isAvailableAsync())
    throw new Error('El segundo plano requiere un development build configurado para ubicación.');
  const permiso = await Location.requestBackgroundPermissionsAsync();
  if (!permiso.granted) throw new Error('No autorizaste ubicación en segundo plano. Puedes usar el modo visible.');
  await serial(async () => {
    const credencial = await tokens.get();
    if (!credencial || `Bearer ${credencial}` !== autorizacion || !vigente()) throw new Error('Tu sesión cambió.');
    await SecureStore.setItemAsync(CLAVE, JSON.stringify({ sesion, usuario, credencial } satisfies Guardada));
    if (!vigente()) { await detenerInterno(sesion.sesion); return; }
    try {
    await Location.startLocationUpdatesAsync(TAREA, { accuracy: Location.Accuracy.High,
      distanceInterval: 10, timeInterval: 5000, deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true, pausesUpdatesAutomatically: false,
      foregroundService: { notificationTitle: 'Fixly · Ubicación del servicio',
        notificationBody: 'Compartes tu ubicación mientras vas al servicio. Puedes detenerla desde la app.',
        killServiceOnDestroy: true } });
    } catch (e) { await detenerInterno(sesion.sesion); throw e; }
  });
}
export async function recuperarSegundoPlano(usuario: number): Promise<SesionGps | null> {
  return serial(async () => {
    if (!await TaskManager.isAvailableAsync()) return null;
    const valor = await SecureStore.getItemAsync(CLAVE);
    if (!valor) return null;
    try {
      const g = JSON.parse(valor) as Guardada;
      const token = await tokens.get();
      if (g.usuario === usuario && g.credencial === token && Date.parse(g.sesion.expiraEn) > Date.now()
        && await Location.hasStartedLocationUpdatesAsync(TAREA)) return g.sesion;
    } catch { /* Un registro incompleto no autoriza captura. */ }
    await detenerInterno(); return null;
  });
}

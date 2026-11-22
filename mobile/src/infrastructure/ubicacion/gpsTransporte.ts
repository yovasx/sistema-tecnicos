import { SesionGps } from '../../domain/models/Operacion';
import { urlApi } from '../http/HogarApiRepository';

export interface MuestraGps {
  latitud: number; longitud: number; precision: number; capturadoEn: string;
}
export class ErrorGps extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}
export async function enviarMuestraGps(s: SesionGps, muestra: MuestraGps, autorizacion: string) {
  const cancelar = new AbortController();
  const tiempo = setTimeout(() => cancelar.abort(), 10000);
  try {
    const r = await fetch(urlApi('/api/tecnicos/ubicacion'), {
      method: 'POST', signal: cancelar.signal,
      headers: { Authorization: autorizacion, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesion: s.sesion, ...muestra }),
    });
    if (!r.ok) throw new ErrorGps(r.status, 'El servidor no aceptó la ubicación. Actualiza el servicio.');
  } finally { clearTimeout(tiempo); }
}
export async function cerrarSesionGps(s: SesionGps, autorizacion: string) {
  const cancelar = new AbortController();
  const tiempo = setTimeout(() => cancelar.abort(), 5000);
  try { await fetch(urlApi(`/api/tecnicos/gps/${s.sesion}`), {
    method: 'DELETE', headers: { Authorization: autorizacion }, signal: cancelar.signal,
  }); } catch { /* Captura detenida localmente; el permiso también vence en servidor. */ }
  finally { clearTimeout(tiempo); }
}

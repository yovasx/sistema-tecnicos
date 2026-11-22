import { Platform } from 'react-native';
import { Direccion, GuardarDireccion, Reputacion, Seguimiento } from '../../domain/models/Hogar';
import { PerfilPropio } from '../../domain/models/Perfil';
import { EvidenciaServicio } from '../../domain/models/SolicitudServicio';
import { HogarRepository } from '../../domain/repositories/HogarRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export function urlApi(ruta: string) {
  const base = apiClient.defaults.baseURL;
  if (!base) throw new Error('Configura la dirección de la API.');
  if (base.startsWith('/')) return ruta;
  return base.replace(/\/$/, '') + ruta;
}

export class HogarApiRepository implements HogarRepository {
  async direcciones() {
    try { return (await apiClient.get<Direccion[]>('/api/perfil/direcciones')).data; }
    catch (e) { throw traducirError(e); }
  }
  async guardarDireccion(id: number | null, datos: GuardarDireccion) {
    try { return id === null
      ? (await apiClient.post<Direccion>('/api/perfil/direcciones', datos)).data
      : (await apiClient.put<Direccion>(`/api/perfil/direcciones/${id}`, datos)).data;
    } catch (e) { throw traducirError(e); }
  }
  async quitarDireccion(id: number) {
    try { await apiClient.delete(`/api/perfil/direcciones/${id}`); }
    catch (e) { throw traducirError(e); }
  }
  async reputacion() {
    try { return (await apiClient.get<Reputacion>('/api/perfil/reputacion')).data; }
    catch (e) { throw traducirError(e); }
  }
  async calificar(orden: number, puntaje: number, comentario: string, tecnico = false) {
    try { await apiClient.post(`${tecnico ? '/api/tecnicos/ordenes' : '/api/ordenes'}/${orden}/calificacion`, { puntaje, comentario }); }
    catch (e) { throw traducirError(e); }
  }
  async foto(archivo: EvidenciaServicio) {
    const form = new FormData();
    if (Platform.OS === 'web' && archivo.contenidoWeb)
      form.append('archivo', archivo.contenidoWeb, archivo.nombre);
    else form.append('archivo', { uri: archivo.uri, name: archivo.nombre, type: archivo.tipo } as unknown as Blob);
    try { return (await apiClient.post<PerfilPropio>('/api/perfil/foto', form, {
      timeout: 30000,
      ...(Platform.OS === 'web' ? {} : { headers: { 'Content-Type': 'multipart/form-data' } }),
    })).data; } catch (e) { throw traducirError(e); }
  }
  async quitarFoto() {
    try { return (await apiClient.delete<PerfilPropio>('/api/perfil/foto')).data; }
    catch (e) { throw traducirError(e); }
  }
  async seguimiento(orden: number) {
    try { return (await apiClient.get<Seguimiento>(`/api/ordenes/${orden}/seguimiento`)).data; }
    catch (e) { throw traducirError(e); }
  }
  conectar(orden: number, recibir: (dato: Seguimiento) => void, estado: (texto: string) => void) {
    let cerrado = false;
    let socket: WebSocket | null = null;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let vigilancia: ReturnType<typeof setTimeout> | undefined;
    let intentos = 0;
    const conectar = async () => {
      try {
        estado(intentos ? 'Reconectando…' : 'Conectando…');
        const { data } = await apiClient.post<{ ticket: string }>(`/api/ordenes/${orden}/seguimiento/ticket`);
        if (cerrado) return;
        const ruta = urlApi('/api/ws/seguimiento');
        const absoluta = ruta.startsWith('/') ? new URL(ruta, window.location.origin).href : ruta;
        const actual = new WebSocket(absoluta.replace(/^http/, 'ws'));
        socket = actual;
        vigilancia = setTimeout(() => actual.close(), 12000);
        actual.onopen = () => actual.send(JSON.stringify({ ticket: data.ticket }));
        actual.onmessage = (e) => {
          if (cerrado || socket !== actual) return;
          try {
            const dato = JSON.parse(String(e.data)) as Seguimiento;
            if (dato.orden !== orden || typeof dato.estado !== 'string') return;
            clearTimeout(vigilancia);
            vigilancia = setTimeout(() => actual.close(), 12000);
            recibir(dato); intentos = 0;
            estado(dato.vigente ? 'En vivo' : 'Sin señal reciente');
            if (dato.estado !== 'en_camino') { cerrado = true; actual.close(); }
          } catch { estado('No pudimos leer la actualización.'); }
        };
        actual.onerror = () => actual.close();
        actual.onclose = () => {
          clearTimeout(vigilancia);
          if (!cerrado) {
            estado('Conexión interrumpida. Reconectando…');
            temporizador = setTimeout(() => void conectar(), Math.min(30000, 2000 * 2 ** intentos++));
          }
        };
      } catch (e) {
        if (cerrado) return;
        estado('Seguimiento no disponible. Puedes actualizar el estado.');
        const error = traducirError(e);
        if (error.estado && error.estado < 500 && error.estado !== 429) return;
        temporizador = setTimeout(() => void conectar(), Math.min(30000, 2000 * 2 ** intentos++));
      }
    };
    void conectar();
    return () => { cerrado = true; clearTimeout(temporizador); clearTimeout(vigilancia); socket?.close(); };
  }
}

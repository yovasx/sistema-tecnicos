import { Platform } from 'react-native';
import { GestionLocalRepository } from '../../domain/repositories/GestionLocalRepository';
import { Atencion, Equipo, Sucursal, HistorialEquipo, PanelCoordinacion, Candidato, EntregaTrabajo } from '../../domain/models/GestionLocal';
import { descargarEvidenciaOrden } from '../storage/evidenciaOrden';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class GestionLocalApiRepository implements GestionLocalRepository {
  private ruta(orden: number) { return `/api/servicios/${orden}/atencion`; }
  private async get<T>(url: string): Promise<T> {
    try { return (await apiClient.get<T>(url)).data; } catch (e) { throw traducirError(e); }
  }
  private async post(url: string, datos: unknown): Promise<void> {
    try { await apiClient.post(url, datos); } catch (e) { throw traducirError(e); }
  }
  atencion(orden: number) { return this.get<Atencion>(this.ruta(orden)); }
  async codigo(orden: number) {
    try { return (await apiClient.post<{ codigo: string }>(`${this.ruta(orden)}/codigo`)).data.codigo; }
    catch (e) { throw traducirError(e); }
  }
  llegada(orden: number, codigo: string) { return this.post(`${this.ruta(orden)}/llegada`, { codigo }); }
  incidencia(orden: number, revision: number, accion: string, motivo: string, fecha?: string) {
    return this.post(`${this.ruta(orden)}/incidencia`, { revision, accion, motivo, fecha });
  }
  resolver(orden: number, revision: number, accion: string, motivo: string, fecha?: string) {
    return this.post(`/api/admin/operacion/${orden}/resolver`, { revision, accion, motivo, fecha });
  }
  reintentar(orden: number, revision: number) { return this.post(`${this.ruta(orden)}/reintentar`, { revision }); }
  conformidad(orden: number, revision: number, conforme: boolean, comentario: string) {
    return this.post(`${this.ruta(orden)}/conformidad`, { revision, conforme, comentario });
  }
  async entregar(orden: number, r: EntregaTrabajo) {
    const form = new FormData();
    form.append('revision', String(r.revision)); form.append('trabajo', r.trabajo);
    if (r.mantenimiento) form.append('mantenimiento', r.mantenimiento);
    const e = r.evidencia;
    if (Platform.OS === 'web' && e.contenidoWeb) form.append('evidencia', e.contenidoWeb, e.nombre);
    else form.append('evidencia', { uri: e.uri, name: e.nombre, type: e.tipo } as unknown as Blob);
    try {
      await apiClient.post(`${this.ruta(orden)}/entrega`, form, {
        timeout: 30000, ...(Platform.OS !== 'web' ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
      });
    } catch (e) { throw traducirError(e); }
  }
  descargarEvidencia(orden: number) { return descargarEvidenciaOrden(orden, 'bin', `${this.ruta(orden)}/evidencia`); }
  equipos() { return this.get<Equipo[]>('/api/equipos'); }
  async guardarEquipo(r: Omit<Equipo, 'id' | 'revision'> & { id?: number; revision?: number }) {
    try { if (r.id) await apiClient.put(`/api/equipos/${r.id}`, r); else await apiClient.post('/api/equipos', r); }
    catch (e) { throw traducirError(e); }
  }
  sucursales() { return this.get<Sucursal[]>('/api/sucursales'); }
  async guardarSucursal(r: Omit<Sucursal, 'id' | 'revision'> & { id?: number; revision?: number }) {
    try { if (r.id) await apiClient.put(`/api/sucursales/${r.id}`, r); else await apiClient.post('/api/sucursales', r); }
    catch (e) { throw traducirError(e); }
  }
  historialEquipo(id: number) { return this.get<HistorialEquipo[]>(`/api/equipos/${id}/historial`); }
  panel() { return this.get<PanelCoordinacion>('/api/admin/operacion'); }
  candidatos(orden: number) { return this.get<Candidato[]>(`/api/admin/operacion/${orden}/candidatos`); }
}

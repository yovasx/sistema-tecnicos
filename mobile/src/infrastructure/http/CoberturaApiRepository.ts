import { Cobertura, Pertenencia, PuntoCobertura, PropuestaCobertura } from '../../domain/models/Cobertura';
import { Pagina } from '../../domain/models/Operacion';
import { CoberturaRepository, NuevaCobertura } from '../../domain/repositories/CoberturaRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class CoberturaApiRepository implements CoberturaRepository {
  private async get<T>(ruta: string): Promise<T> {
    try { return (await apiClient.get<T>(ruta)).data; } catch (e) { throw traducirError(e); }
  }
  private async post(ruta: string, datos?: unknown): Promise<void> {
    try { await apiClient.post(ruta, datos); } catch (e) { throw traducirError(e); }
  }
  propia(p: number) { return this.get<Cobertura>(`/api/tecnicos/cobertura?pagina=${p}`); }
  tecnico(id: number, p: number) { return this.get<Cobertura>(`/api/admin/tecnicos/${id}/cobertura?pagina=${p}`); }
  pendientes(p: number) { return this.get<Pagina<PropuestaCobertura>>(`/api/admin/coberturas?pagina=${p}`); }
  proponer(datos: NuevaCobertura) { return this.post('/api/tecnicos/cobertura/propuestas', datos); }
  retirar(id: number) { return this.post(`/api/tecnicos/cobertura/propuestas/${id}/retirar`); }
  revisar(id: number, revision: number, aprobar: boolean, motivo: string) {
    return this.post(`/api/admin/coberturas/${id}/revisar`, { revision, aprobar, motivo });
  }
  async comprobar(punto: PuntoCobertura) {
    try { return (await apiClient.post<Pertenencia>('/api/tecnicos/cobertura/comprobar', punto)).data; }
    catch (e) { throw traducirError(e); }
  }
}

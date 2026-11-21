import { EditarPerfil, PerfilPropio } from '../../domain/models/Perfil';
import { PerfilRepository } from '../../domain/repositories/PerfilRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class PerfilApiRepository implements PerfilRepository {
  async propio(): Promise<PerfilPropio> {
    try { return (await apiClient.get<PerfilPropio>('/api/perfil')).data; }
    catch (e) { throw traducirError(e); }
  }
  async editar(datos: EditarPerfil): Promise<PerfilPropio> {
    try { return (await apiClient.put<PerfilPropio>('/api/perfil', datos)).data; }
    catch (e) { throw traducirError(e); }
  }
  async cambiarPassword(actual: string, nueva: string): Promise<void> {
    try { await apiClient.post('/api/perfil/password', { actual, nueva }); }
    catch (e) { throw traducirError(e); }
  }
}

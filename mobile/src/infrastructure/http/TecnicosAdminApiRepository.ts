import { DetalleTecnicoAdmin, FiltrosTecnicos, PaginaTecnicos, RevisionTecnicoAdmin } from '../../domain/models/TecnicoAdmin';
import { TecnicosAdminRepository } from '../../domain/repositories/TecnicosAdminRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class TecnicosAdminApiRepository implements TecnicosAdminRepository {
  async listar(params: FiltrosTecnicos): Promise<PaginaTecnicos> {
    try { return (await apiClient.get<PaginaTecnicos>('/api/admin/tecnicos', { params })).data; }
    catch (e) { throw traducirError(e); }
  }
  async detalle(id: number): Promise<DetalleTecnicoAdmin> {
    try { return (await apiClient.get<DetalleTecnicoAdmin>(`/api/admin/tecnicos/${id}`)).data; }
    catch (e) { throw traducirError(e); }
  }
  async revisiones(id: number, pagina: number): Promise<RevisionTecnicoAdmin[]> {
    try { return (await apiClient.get<RevisionTecnicoAdmin[]>(`/api/admin/tecnicos/${id}/revisiones`, { params: { pagina } })).data; }
    catch (e) { throw traducirError(e); }
  }
}

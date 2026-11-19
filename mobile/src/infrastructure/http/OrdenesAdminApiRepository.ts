import { DetalleOrdenAdmin, FilaOrdenAdmin, FiltrosOrdenesAdmin, PaginaOrdenes, TransicionOrdenAdmin } from '../../domain/models/OrdenAdmin';
import { OrdenesAdminRepository } from '../../domain/repositories/OrdenesAdminRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class OrdenesAdminApiRepository implements OrdenesAdminRepository {
  async listar(params: FiltrosOrdenesAdmin): Promise<PaginaOrdenes<FilaOrdenAdmin>> {
    try { return (await apiClient.get<PaginaOrdenes<FilaOrdenAdmin>>('/api/admin/ordenes', { params })).data; }
    catch (e) { throw traducirError(e); }
  }
  async detalle(id: number): Promise<DetalleOrdenAdmin> {
    try { return (await apiClient.get<DetalleOrdenAdmin>(`/api/admin/ordenes/${id}`)).data; }
    catch (e) { throw traducirError(e); }
  }
  async historial(id: number, pagina: number): Promise<PaginaOrdenes<TransicionOrdenAdmin>> {
    try { return (await apiClient.get<PaginaOrdenes<TransicionOrdenAdmin>>(`/api/admin/ordenes/${id}/historial`, { params: { pagina, tamano: 20 } })).data; }
    catch (e) { throw traducirError(e); }
  }
}

import {
  CategoriaAdmin,
  ResumenAdmin,
  TecnicoPendiente,
  UsuarioAdmin,
} from '../../domain/models/Admin';
import { AdminRepository } from '../../domain/repositories/AdminRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

/** Adaptador HTTP del puerto admin. Todos los endpoints exigen rol administrador. */
export class AdminApiRepository implements AdminRepository {
  async resumen(): Promise<ResumenAdmin> {
    try {
      const { data } = await apiClient.get<ResumenAdmin>('/api/admin/resumen');
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }

  async usuarios(): Promise<UsuarioAdmin[]> {
    try {
      const { data } = await apiClient.get<UsuarioAdmin[]>('/api/admin/usuarios');
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }

  async categorias(): Promise<CategoriaAdmin[]> {
    try {
      const { data } = await apiClient.get<CategoriaAdmin[]>('/api/admin/categorias');
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }

  async tecnicosPendientes(): Promise<TecnicoPendiente[]> {
    try {
      const { data } = await apiClient.get<TecnicoPendiente[]>('/api/admin/tecnicos/pendientes');
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }
}

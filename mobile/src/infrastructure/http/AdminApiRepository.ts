import {
  CategoriaAdmin,
  GuardarCategoriaInput,
  ResumenAdmin, EditarPerfilAdmin, DashboardAdmin,
  TecnicoPendiente,
  UsuarioAdmin,
  FiltrosUsuarios, PaginaUsuarios, DetalleUsuarioAdmin, EditarUsuarioAdmin, EstadoUsuarioAdmin, CambioUsuarioAdmin, InvitacionUsuarioAdmin,
} from '../../domain/models/Admin';
import { AdminRepository } from '../../domain/repositories/AdminRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

/** Adaptador HTTP del puerto admin. Todos los endpoints exigen rol administrador. */
export class AdminApiRepository implements AdminRepository {
  async dashboard(dias: 7 | 30): Promise<DashboardAdmin> {
    try { return (await apiClient.get<DashboardAdmin>('/api/admin/dashboard', { params: { dias } })).data; }
    catch (error) { throw traducirError(error); }
  }
  async perfil(): Promise<DetalleUsuarioAdmin> {
    try { return (await apiClient.get<DetalleUsuarioAdmin>('/api/admin/perfil')).data; }
    catch (error) { throw traducirError(error); }
  }
  async editarPerfil(datos: EditarPerfilAdmin): Promise<DetalleUsuarioAdmin> {
    try { return (await apiClient.put<DetalleUsuarioAdmin>('/api/admin/perfil', datos)).data; }
    catch (error) { throw traducirError(error); }
  }
  async invitarUsuario(datos: InvitacionUsuarioAdmin): Promise<void> {
    try { await apiClient.post('/api/admin/usuarios/invitaciones', datos); }
    catch (error) { throw traducirError(error); }
  }
  async paginaUsuarios(params: FiltrosUsuarios): Promise<PaginaUsuarios> {
    try { return (await apiClient.get<PaginaUsuarios>('/api/admin/usuarios/pagina', { params })).data; }
    catch (error) { throw traducirError(error); }
  }
  async usuario(id: number): Promise<DetalleUsuarioAdmin> {
    try { return (await apiClient.get<DetalleUsuarioAdmin>(`/api/admin/usuarios/${id}`)).data; }
    catch (error) { throw traducirError(error); }
  }
  async editarUsuario(id: number, datos: EditarUsuarioAdmin): Promise<DetalleUsuarioAdmin> {
    try { return (await apiClient.put<DetalleUsuarioAdmin>(`/api/admin/usuarios/${id}`, datos)).data; }
    catch (error) { throw traducirError(error); }
  }
  async estadoUsuario(id: number, datos: EstadoUsuarioAdmin): Promise<DetalleUsuarioAdmin> {
    try { return (await apiClient.patch<DetalleUsuarioAdmin>(`/api/admin/usuarios/${id}/estado`, datos)).data; }
    catch (error) { throw traducirError(error); }
  }
  async historialUsuario(id: number, pagina: number): Promise<CambioUsuarioAdmin[]> {
    try { return (await apiClient.get<CambioUsuarioAdmin[]>(`/api/admin/usuarios/${id}/historial`, { params: { pagina } })).data; }
    catch (error) { throw traducirError(error); }
  }
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

  async crearCategoria(input: GuardarCategoriaInput): Promise<CategoriaAdmin> {
    try {
      const { data } = await apiClient.post<CategoriaAdmin>('/api/admin/categorias', input);
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }

  async actualizarCategoria(id: number, input: GuardarCategoriaInput): Promise<CategoriaAdmin> {
    try {
      const { data } = await apiClient.put<CategoriaAdmin>(`/api/admin/categorias/${id}`, input);
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

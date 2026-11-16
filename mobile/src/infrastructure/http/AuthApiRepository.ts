import { SesionIniciada, UsuarioSesion } from '../../domain/models/Sesion';
import { AuthRepository } from '../../domain/repositories/AuthRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

/** Adaptador HTTP del puerto de autenticación. */
export class AuthApiRepository implements AuthRepository {
  async login(email: string, password: string): Promise<SesionIniciada> {
    try {
      const { data } = await apiClient.post<SesionIniciada>('/api/auth/login', {
        email,
        password,
      });
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }

  async me(): Promise<UsuarioSesion> {
    try {
      const { data } = await apiClient.get<UsuarioSesion>('/api/auth/me');
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }
}

import { DatosRegistroCliente } from '../../domain/models/Registro';
import { DatosRegistroTecnico } from '../../domain/models/Expediente';
import { SesionIniciada, UsuarioSesion } from '../../domain/models/Sesion';
import { AuthRepository } from '../../domain/repositories/AuthRepository';
import { PropositoGoogle } from '../../domain/models/Google';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

/** Adaptador HTTP del puerto de autenticación. */
export class AuthApiRepository implements AuthRepository {
  async vincularGoogle(idToken: string, nonce: string, password: string): Promise<void> {
    try { await apiClient.post('/api/auth/google/vincular', { idToken, nonce, password }); }
    catch (e) { throw traducirError(e); }
  }
  async desafioGoogle(proposito: PropositoGoogle = 'acceso'): Promise<{ nonce: string }> {
    try { return (await apiClient.post<{ nonce: string }>('/api/auth/google/desafio', { proposito })).data; }
    catch (e) { throw traducirError(e); }
  }
  async google(idToken: string, nonce: string, nombre?: string, apellido?: string): Promise<SesionIniciada> {
    try { return (await apiClient.post<SesionIniciada>('/api/auth/google', { idToken, nonce, nombre, apellido })).data; }
    catch (e) { throw traducirError(e); }
  }
  async registrarTecnico(datos: DatosRegistroTecnico): Promise<SesionIniciada> {
    try { return (await apiClient.post<SesionIniciada>('/api/tecnicos/registro', datos)).data; }
    catch (e) { throw traducirError(e); }
  }
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

  async registrar(datos: DatosRegistroCliente): Promise<SesionIniciada> {
    try {
      const { data } = await apiClient.post<SesionIniciada>('/api/auth/registro', datos);
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

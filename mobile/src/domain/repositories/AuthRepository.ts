import { SesionIniciada, UsuarioSesion } from '../models/Sesion';

/**
 * Puerto de autenticación. La app no sabe si detrás hay axios, fetch o un mock:
 * solo pide iniciar sesión y consultar la sesión actual.
 */
export interface AuthRepository {
  login(email: string, password: string): Promise<SesionIniciada>;
  me(): Promise<UsuarioSesion>;
}

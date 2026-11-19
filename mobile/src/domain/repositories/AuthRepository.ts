import { DatosRegistroCliente } from '../models/Registro';
import { DatosRegistroTecnico } from '../models/Expediente';
import { SesionIniciada, UsuarioSesion } from '../models/Sesion';

/**
 * Puerto de autenticación. La app no sabe si detrás hay axios, fetch o un mock:
 * solo pide iniciar sesión, registrarse y consultar la sesión actual.
 */
export interface AuthRepository {
  desafioGoogle(): Promise<{ nonce: string }>;
  vincularGoogle(idToken: string, nonce: string, password: string): Promise<void>;
  google(idToken: string, nonce: string, nombre?: string, apellido?: string): Promise<SesionIniciada>;
  login(email: string, password: string): Promise<SesionIniciada>;
  /** Alta pública de cliente. Devuelve la sesión ya iniciada. */
  registrar(datos: DatosRegistroCliente): Promise<SesionIniciada>;
  registrarTecnico(datos: DatosRegistroTecnico): Promise<SesionIniciada>;
  me(): Promise<UsuarioSesion>;
}

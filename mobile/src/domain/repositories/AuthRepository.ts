import { DatosRegistroCliente } from '../models/Registro';
import { DatosRegistroTecnico } from '../models/Expediente';
import { SesionIniciada, UsuarioSesion } from '../models/Sesion';

/**
 * Puerto de autenticación. La app no sabe si detrás hay axios, fetch o un mock:
 * solo pide iniciar sesión, registrarse y consultar la sesión actual.
 */
export interface AuthRepository {
  login(email: string, password: string): Promise<SesionIniciada>;
  /** Alta pública de cliente. Devuelve la sesión ya iniciada. */
  registrar(datos: DatosRegistroCliente): Promise<SesionIniciada>;
  registrarTecnico(datos: DatosRegistroTecnico): Promise<SesionIniciada>;
  me(): Promise<UsuarioSesion>;
}

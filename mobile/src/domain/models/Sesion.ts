/**
 * Modelo de sesión de la app.
 *
 * Ojo: `rol` es la autorización (lo que el backend acepta en `hasRole`) y
 * `tipoCliente` es el perfil. Una empresa tiene `rol: 'cliente'` y
 * `tipoCliente: 'empresa'`; nunca se inventa un rol `empresa`.
 */
export type Rol = 'cliente' | 'tecnico' | 'administrador';

export type TipoCliente = 'persona' | 'empresa';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  tipoCliente: TipoCliente;
  razonSocial: string | null;
  nit: string | null;
}

export interface SesionIniciada {
  token: string;
  expiraEn: string;
  usuario: UsuarioSesion;
}

export type EstadoSesion = 'cargando' | 'anonimo' | 'autenticado';

export function esClienteEmpresa(usuario: UsuarioSesion | null): boolean {
  return usuario?.rol === 'cliente' && usuario.tipoCliente === 'empresa';
}

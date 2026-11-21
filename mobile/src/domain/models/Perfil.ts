import { Rol, TipoCliente } from './Sesion';

export type MetodoAcceso = 'password' | 'google' | 'google_y_password';
export interface PerfilPropio {
  id: number;
  revision: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  tipoCliente: TipoCliente;
  razonSocial: string | null;
  nit: string | null;
  acceso: MetodoAcceso;
  estadoValidacion: string | null;
  especialidades: string[];
  fotoUrl: string | null;
}
export interface EditarPerfil {
  revision: number;
  nombre: string;
  apellido: string;
  telefono: string;
  razonSocial: string;
  nit: string;
}

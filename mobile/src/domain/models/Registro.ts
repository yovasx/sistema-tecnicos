/**
 * Datos del alta pública de un cliente.
 *
 * Nunca incluye `rol`: el backend siempre crea clientes. El perfil
 * (`persona` | `empresa`) es lo único que elige quien se registra.
 */
export interface DatosRegistroCliente {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  password: string;
  tipoCliente: 'persona' | 'empresa';
  /** Obligatorio cuando `tipoCliente` es `empresa`. */
  razonSocial?: string;
  /** Obligatorio cuando `tipoCliente` es `empresa`. */
  nit?: string;
}

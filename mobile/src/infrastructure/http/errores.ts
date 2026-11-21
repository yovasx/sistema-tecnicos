import axios from 'axios';

export interface CampoError {
  campo: string;
  mensaje: string;
}

/**
 * Error de la API con el contrato del backend: `{ codigo, mensaje, campos }`.
 *
 * Los códigos que la UI distingue son `CREDENCIALES_INVALIDAS`,
 * `CUENTA_INACTIVA`, `NO_AUTENTICADO` y `SIN_CONEXION`. El resto se muestra con
 * el mensaje del servidor.
 */
export class ErrorApi extends Error {
  readonly codigo: string;
  readonly estado?: number;
  readonly campos: CampoError[];

  constructor(codigo: string, mensaje: string, estado?: number, campos: CampoError[] = []) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.estado = estado;
    this.campos = campos;
  }

  get sinConexion(): boolean {
    return this.codigo === 'SIN_CONEXION';
  }
}

/** Traduce cualquier fallo de axios a un error tipado de la app. */
export function traducirError(error: unknown): ErrorApi {
  if (error instanceof ErrorApi) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ErrorApi(
        'SIN_CONEXION',
        'Sin conexión con el servidor. Revisa la IP, el puerto y el firewall.',
      );
    }

    const { status, data } = error.response;
    const cuerpo = (data ?? {}) as {
      codigo?: unknown;
      mensaje?: unknown;
      campos?: unknown;
    };

    const codigo = typeof cuerpo.codigo === 'string' ? cuerpo.codigo : 'ERROR_SERVIDOR';
    const mensaje =
      typeof cuerpo.mensaje === 'string' && cuerpo.mensaje.length > 0
        ? cuerpo.mensaje
        : 'Ocurrió un error inesperado. Intenta de nuevo.';
    const campos = Array.isArray(cuerpo.campos) ? (cuerpo.campos as CampoError[]) : [];

    return new ErrorApi(codigo, mensaje, status, campos);
  }

  return new ErrorApi(
    'ERROR_DESCONOCIDO',
    'Ocurrió un error inesperado. Intenta de nuevo.',
  );
}

import axios from 'axios';

/**
 * Cliente HTTP único de la app.
 *
 * El token se guarda en memoria (`Authorization`) y en el storage del
 * dispositivo. Cuando cualquier request protegido responde 401, se avisa al
 * proveedor de sesión para volver al login. El login queda excluido: ahí un 401
 * es una contraseña incorrecta, no una sesión vencida.
 */
export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
});

let alVencerSesion: (() => void) | null = null;

export function registrarSesionVencida(manejador: (() => void) | null) {
  alVencerSesion = manejador;
}

export function definirToken(token: string | null) {
  apiClient.defaults.headers.common.Authorization = token ? `Bearer ${token}` : undefined;
}

apiClient.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const url: string = error?.config?.url ?? '';
    // En login y registro un 401/409 es del formulario, no una sesión vencida.
    const esFormularioPublico =
      url.includes('/api/auth/login') || url.includes('/api/auth/registro') || url.includes('/api/auth/google')
      || url.includes('/api/auth/recuperacion');

    if (error?.response?.status === 401 && !esFormularioPublico) {
      alVencerSesion?.();
    }

    return Promise.reject(error);
  },
);

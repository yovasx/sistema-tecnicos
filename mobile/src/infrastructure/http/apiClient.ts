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
    const esLogin = url.includes('/api/auth/login');

    if (error?.response?.status === 401 && !esLogin) {
      alVencerSesion?.();
    }

    return Promise.reject(error);
  },
);

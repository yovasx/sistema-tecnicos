import { Platform } from 'react-native';
import { AdminApiRepository } from './http/AdminApiRepository';
import { AuthApiRepository } from './http/AuthApiRepository';
import { PublicoApiRepository } from './http/PublicoApiRepository';
import { SecureTokenStorage } from './storage/SecureTokenStorage';
import { WebTokenStorage } from './storage/WebTokenStorage';

/**
 * Composition root manual: elige el storage según la plataforma y arma los
 * repositorios. No hay framework de DI.
 */
export const tokenStorage =
  Platform.OS === 'web' ? new WebTokenStorage() : new SecureTokenStorage();

export const authRepository = new AuthApiRepository();
export const adminRepository = new AdminApiRepository();
export const publicoRepository = new PublicoApiRepository();

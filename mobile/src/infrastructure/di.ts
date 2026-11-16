import { Platform } from 'react-native';
import { AuthApiRepository } from './http/AuthApiRepository';
import { SecureTokenStorage } from './storage/SecureTokenStorage';
import { WebTokenStorage } from './storage/WebTokenStorage';

/**
 * Composition root manual: elige el storage según la plataforma y arma el
 * repositorio de autenticación. No hay framework de DI.
 */
export const tokenStorage =
  Platform.OS === 'web' ? new WebTokenStorage() : new SecureTokenStorage();

export const authRepository = new AuthApiRepository();

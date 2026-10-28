import { Platform } from 'react-native';
import { SecureTokenStorage } from './storage/SecureTokenStorage';
import { WebTokenStorage } from './storage/WebTokenStorage';

export const tokenStorage =
  Platform.OS === 'web' ? new WebTokenStorage() : new SecureTokenStorage();
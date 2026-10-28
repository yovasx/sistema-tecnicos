import * as SecureStore from 'expo-secure-store';
import { TokenStorage } from '../../domain/repositories/TokenStorage';

const KEY = 'access_token';

export class SecureTokenStorage implements TokenStorage {
  get() { return SecureStore.getItemAsync(KEY); }
  save(token: string) { return SecureStore.setItemAsync(KEY, token); }
  clear() { return SecureStore.deleteItemAsync(KEY); }
}

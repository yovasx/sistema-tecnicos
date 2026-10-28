import { TokenStorage } from '../../domain/repositories/TokenStorage';

const KEY = 'access_token';

export class WebTokenStorage implements TokenStorage {
  async get() { return localStorage.getItem(KEY); }
  async save(token: string) { localStorage.setItem(KEY, token); }
  async clear() { localStorage.removeItem(KEY); }
}
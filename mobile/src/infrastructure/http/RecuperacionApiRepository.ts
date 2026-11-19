import { RecuperacionRepository } from '../../domain/repositories/RecuperacionRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';
export class RecuperacionApiRepository implements RecuperacionRepository {
  private async enviar<T>(ruta: string, datos: unknown): Promise<T> {
    try { return (await apiClient.post<T>(`/api/auth/recuperacion/${ruta}`, datos)).data; }
    catch (e) { throw traducirError(e); }
  }
  solicitar(email: string) { return this.enviar<{ solicitudId: string; mensaje: string }>('solicitar', { email }); }
  confirmar(solicitudId: string, codigo: string) { return this.enviar<{ permiso: string }>('confirmar', { solicitudId, codigo }); }
  restablecer(solicitudId: string, permiso: string, password: string) {
    return this.enviar<void>('restablecer', { solicitudId, permiso, password });
  }
}

import { InvitacionRepository } from '../../domain/repositories/InvitacionRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class InvitacionApiRepository implements InvitacionRepository {
  async aceptar(email: string, permiso: string, password: string): Promise<void> {
    try { await apiClient.post('/api/auth/invitaciones/aceptar', { email, permiso, password }); }
    catch (error) { throw traducirError(error); }
  }
}

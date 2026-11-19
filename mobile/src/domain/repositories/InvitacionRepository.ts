export interface InvitacionRepository {
  aceptar(email: string, permiso: string, password: string): Promise<void>;
}

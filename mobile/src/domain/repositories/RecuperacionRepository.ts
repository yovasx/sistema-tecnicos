export interface RecuperacionRepository {
  solicitar(email: string): Promise<{ solicitudId: string; mensaje: string }>;
  confirmar(solicitudId: string, codigo: string): Promise<{ permiso: string }>;
  restablecer(solicitudId: string, permiso: string, password: string): Promise<void>;
}

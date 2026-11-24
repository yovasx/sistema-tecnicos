import { EditarPerfil, PerfilPropio } from '../models/Perfil';

export interface PerfilRepository {
  propio(): Promise<PerfilPropio>;
  editar(datos: EditarPerfil): Promise<PerfilPropio>;
  cambiarPassword(actual: string, nueva: string): Promise<void>;
}

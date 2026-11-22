import { SesionGps } from '../../domain/models/Operacion';
export async function iniciarSegundoPlano(_s: SesionGps, _usuario: number, _autorizacion: string, _vigente: () => boolean) {
  throw new Error('La web solo comparte ubicación mientras está visible.');
}
export async function detenerSegundoPlano(_sesion?: string) {}
export async function recuperarSegundoPlano(_usuario: number): Promise<SesionGps | null> { return null; }

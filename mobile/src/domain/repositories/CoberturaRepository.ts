import { Cobertura, Pertenencia, PuntoCobertura, PropuestaCobertura, ZonaPropuesta } from '../models/Cobertura';
import { Pagina } from '../models/Operacion';

export interface NuevaCobertura { clave: string; revision: number; motivo: string; zonas: ZonaPropuesta[] }
export interface CoberturaRepository {
  propia(pagina: number): Promise<Cobertura>;
  tecnico(id: number, pagina: number): Promise<Cobertura>;
  pendientes(pagina: number): Promise<Pagina<PropuestaCobertura>>;
  proponer(datos: NuevaCobertura): Promise<void>;
  retirar(id: number): Promise<void>;
  revisar(id: number, revision: number, aprobar: boolean, motivo: string): Promise<void>;
  comprobar(punto: PuntoCobertura): Promise<Pertenencia>;
}

import { Direccion, GuardarDireccion, Reputacion, Seguimiento } from '../models/Hogar';
import { EvidenciaServicio } from '../models/SolicitudServicio';
import { PerfilPropio } from '../models/Perfil';

export interface HogarRepository {
  direcciones(): Promise<Direccion[]>;
  guardarDireccion(id: number | null, datos: GuardarDireccion): Promise<Direccion>;
  quitarDireccion(id: number): Promise<void>;
  reputacion(): Promise<Reputacion>;
  calificar(orden: number, puntaje: number, comentario: string): Promise<void>;
  foto(archivo: EvidenciaServicio): Promise<PerfilPropio>;
  quitarFoto(): Promise<PerfilPropio>;
  seguimiento(orden: number): Promise<Seguimiento>;
  conectar(orden: number, recibir: (dato: Seguimiento) => void,
    estado: (texto: string) => void): () => void;
}

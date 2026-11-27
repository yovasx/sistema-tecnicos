import { Atencion, Equipo, Sucursal, HistorialEquipo, PanelCoordinacion, Candidato, EntregaTrabajo } from '../models/GestionLocal';

export interface GestionLocalRepository {
  atencion(orden: number): Promise<Atencion>;
  codigo(orden: number): Promise<string>;
  llegada(orden: number, codigo: string): Promise<void>;
  incidencia(orden: number, revision: number, accion: string, motivo: string, fecha?: string): Promise<void>;
  resolver(orden: number, revision: number, accion: string, motivo: string, fecha?: string): Promise<void>;
  reintentar(orden: number, revision: number): Promise<void>;
  entregar(orden: number, datos: EntregaTrabajo): Promise<void>;
  conformidad(orden: number, revision: number, conforme: boolean, comentario: string): Promise<void>;
  descargarEvidencia(orden: number): Promise<void>;
  equipos(): Promise<Equipo[]>;
  guardarEquipo(equipo: Omit<Equipo, 'id' | 'revision'> & { id?: number; revision?: number }): Promise<void>;
  sucursales(): Promise<Sucursal[]>;
  guardarSucursal(sucursal: Omit<Sucursal, 'id' | 'revision'> & { id?: number; revision?: number }): Promise<void>;
  historialEquipo(id: number): Promise<HistorialEquipo[]>;
  panel(): Promise<PanelCoordinacion>;
  candidatos(orden: number): Promise<Candidato[]>;
}

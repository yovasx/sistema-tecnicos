export interface Direccion {
  id: number;
  etiqueta: string;
  referencia: string;
  latitud: number;
  longitud: number;
  predeterminada: boolean;
}
export type GuardarDireccion = Omit<Direccion, 'id'>;
export interface Reputacion {
  promedio: number;
  total: number;
  ordenesFinalizadas: number;
  ordenesCanceladas: number;
  recibidas: { id: number; puntaje: number; comentario: string | null;
    categoria: string; autor: string | null; registradoEn: string }[];
}
export interface Seguimiento {
  orden: number;
  estado: string;
  tecnico: string | null;
  posicion: { latitud: number; longitud: number; precision: number | null; actualizadoEn: string } | null;
  posicionCliente: { latitud: number; longitud: number; precision: number | null; actualizadoEn: string } | null;
  clienteCompartiendo: boolean;
  clienteVigente: boolean;
  etaMinutos: number | null;
  vigente: boolean;
  fichaTecnico: { nombre: string; fotoUrl: string | null; promedio: number | null; totalCalificaciones: number } | null;
}
export interface SesionGpsCliente { sesion: string; orden: number; expiraEn: string }
export interface MuestraGpsCliente {
  latitud: number;
  longitud: number;
  precision: number;
  capturadoEn: string;
}

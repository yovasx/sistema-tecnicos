export type GeometriaZona = { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface ZonaPropuesta { nombre: string; latitud: number; longitud: number; radioMetros: number }
export interface ZonaVigente {
  id: number; nombre: string; geometria: GeometriaZona;
  latitud: number | null; longitud: number | null; radioMetros: number | null;
}
export interface PropuestaCobertura {
  id: number; tecnicoId: number; revision: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'retirada';
  motivo: string; zonas: ZonaPropuesta[]; creadaEn: string;
  revisadaEn: string | null; motivoRevision: string | null;
}
export interface Cobertura {
  revision: number; zonas: ZonaVigente[]; especialidades: string[];
  solicitudes: PropuestaCobertura[]; totalSolicitudes: number; pagina: number;
}
export interface PuntoCobertura {
  latitud: number; longitud: number; precision: number | null; capturadoEn: string;
}
export interface Pertenencia {
  estado: 'dentro' | 'fuera' | 'cerca_limite' | 'ubicacion_insuficiente' | 'sin_cobertura';
  dentro: boolean; distanciaLimiteMetros: number | null; revision: number;
}

import { GeometriaZona } from '../../domain/models/Cobertura';
export interface PuntoMapa { latitud: number; longitud: number }
export interface AreaMapa {
  nombre: string;
  geometria?: GeometriaZona;
  centro?: PuntoMapa;
  radioMetros?: number;
  propuesta?: boolean;
}
export interface PropsMapa {
  destino: PuntoMapa;
  tecnico?: PuntoMapa | null;
  cliente?: PuntoMapa | null;
  onSeleccionar?: (punto: PuntoMapa) => void;
  areas?: AreaMapa[];
  etiquetaPunto?: string;
  /** Puntos adicionales de solo lectura (mapa operativo del backoffice). */
  marcadores?: MarcadorMapa[];
  /** Alto visual del contenedor; no viaja al documento Leaflet. */
  alto?: number;
}
export interface MarcadorMapa extends PuntoMapa {
  etiqueta: string;
  tecnico?: boolean;
}
export function puntoValido(p: unknown): p is PuntoMapa {
  return typeof p === 'object' && p !== null && 'latitud' in p && 'longitud' in p
    && typeof p.latitud === 'number' && Number.isFinite(p.latitud) && Math.abs(p.latitud) <= 90
    && typeof p.longitud === 'number' && Number.isFinite(p.longitud) && Math.abs(p.longitud) <= 180;
}
export function datosMapa(p: PropsMapa) {
  return JSON.stringify({ destino: p.destino, tecnico: p.tecnico ?? null, cliente: p.cliente ?? null, editable: !!p.onSeleccionar,
    areas: p.areas ?? [], etiquetaPunto: p.etiquetaPunto ?? 'Destino',
    marcadores: p.marcadores ?? [] }).replace(/</g, '\\u003c');
}

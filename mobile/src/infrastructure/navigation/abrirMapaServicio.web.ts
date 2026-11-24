import { abrirMapaOrden } from './abrirMapaOrden';

/** Reutiliza la apertura web sin referrer ni acceso a la ventana de Fixly. */
export async function abrirMapaServicio(latitud: number, longitud: number): Promise<void> {
  abrirMapaOrden(latitud, longitud);
}

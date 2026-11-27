import { apiClient } from '../http/apiClient';
import { guardarDescarga } from './descarga';

/**
 * Descarga autenticada de la evidencia. La URL privada nunca se expone: el
 * archivo se pide con el JWT y se entrega al navegador como descarga local.
 */
export async function descargarEvidenciaOrden(
  id: number,
  extension: string | null,
  ruta = `/api/ordenes/${id}/evidencia`,
): Promise<void> {
  const r = await apiClient.get<Blob>(ruta, {
    responseType: 'blob',
  });
  guardarDescarga(r.data, `evidencia-${id}.${extension ?? 'bin'}`);
}

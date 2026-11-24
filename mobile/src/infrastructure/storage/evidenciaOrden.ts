import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiClient } from '../http/apiClient';

/**
 * Descarga autenticada de la evidencia en el teléfono: se guarda en caché y se
 * comparte con la hoja del sistema. El archivo temporal se borra al terminar.
 */
export async function descargarEvidenciaOrden(
  id: number,
  extension: string | null,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite abrir el archivo de evidencia.');
  }
  const autorizacion = apiClient.defaults.headers.common.Authorization;
  const base = apiClient.defaults.baseURL ?? '';
  const destino = new File(Paths.cache, `fixly-evidencia-${id}.${extension ?? 'bin'}`);
  const archivo = await File.downloadFileAsync(
    `${base}/api/ordenes/${id}/evidencia`,
    destino,
    {
      idempotent: true,
      headers: autorizacion ? { Authorization: String(autorizacion) } : {},
    },
  );
  try {
    await Sharing.shareAsync(archivo.uri, {
      dialogTitle: 'Guardar evidencia del servicio',
    });
  } finally {
    if (archivo.exists) archivo.delete();
  }
}

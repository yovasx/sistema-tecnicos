import { Linking } from 'react-native';

/** Solo por acción explícita; comparte únicamente el punto del servicio. */
export async function abrirMapaServicio(latitud: number, longitud: number): Promise<void> {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) ||
      Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    throw new Error('Las coordenadas registradas no son válidas.');
  }
  const lat = latitud.toFixed(6), lng = longitud.toFixed(6);
  await Linking.openURL(
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
  );
}

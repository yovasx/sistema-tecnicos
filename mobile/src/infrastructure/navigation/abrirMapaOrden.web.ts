/** Solo por acción explícita. No comparte contactos, referencias ni el ID de orden. */
export function abrirMapaOrden(latitud: number, longitud: number) {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    throw new Error('Las coordenadas registradas no son válidas.');
  }
  const lat = latitud.toFixed(6), lng = longitud.toFixed(6);
  window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`, '_blank', 'noopener,noreferrer');
}

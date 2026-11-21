import * as Location from 'expo-location';

/** Consulta puntual, con permiso explícito; nunca observa ni rastrea en segundo plano. */
export async function ubicacionActual(): Promise<{ lat: number; lng: number }> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (!permiso.granted) throw new Error('Sin permiso de ubicación. Puedes ingresar las coordenadas manualmente.');
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    const posicion = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error('No pudimos obtener tu ubicación. Usa las coordenadas manuales.')), 15000);
      }),
    ]);
    return { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
  } finally { clearTimeout(temporizador); }
}

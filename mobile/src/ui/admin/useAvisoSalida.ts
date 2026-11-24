import { useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';

/** El borrador vive en memoria; no almacenar contraseñas ni datos personales. */
export function useAvisoSalida(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Tienes cambios sin guardar', 'Guarda o cancela la edición antes de salir de la aplicación.');
      return true;
    });
    return () => listener.remove();
  }, [activo]);
}

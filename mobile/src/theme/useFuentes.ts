import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

/**
 * Carga las dos familias del sistema (Hanken Grotesk para títulos, Inter para
 * texto) una sola vez al arrancar. Mientras cargan, la app no se pinta: si se
 * pintara con la fuente del sistema, el primer frame saltaría de tipografía.
 */
export function useFuentes() {
  const [cargadas, error] = useFonts({
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return { cargadas: cargadas || Boolean(error), error };
}

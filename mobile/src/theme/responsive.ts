import { Platform, useWindowDimensions } from 'react-native';

/**
 * Regla de escritorio: solo en web y con ventana ancha.
 *
 * En teléfono nativo nunca se activa, aunque el aparato sea grande, porque la
 * app móvil es de columna única. En el navegador, redimensionar la ventana
 * cambia la shell en caliente.
 */
export const UMBRAL_ESCRITORIO = 1024;

export interface Responsive {
  esDesktop: boolean;
  esMovil: boolean;
  ancho: number;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const esDesktop = Platform.OS === 'web' && width >= UMBRAL_ESCRITORIO;
  return { esDesktop, esMovil: !esDesktop, ancho: width };
}

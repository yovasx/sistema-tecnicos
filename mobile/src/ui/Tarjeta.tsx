import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colores, espacio, radio, sombraTarjeta } from '../theme/tokens';

export interface TarjetaProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  relleno?: number;
}

/** Superficie base de la app: blanca, radio 16, borde suave y sombra mínima. */
export function Tarjeta({ children, style, relleno = espacio.lg }: TarjetaProps) {
  return (
    <View style={[estilos.tarjeta, { padding: relleno }, style]}>{children}</View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
    ...sombraTarjeta,
  },
});

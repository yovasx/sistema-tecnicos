import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResponsive } from '../theme/responsive';
import { colores } from '../theme/tokens';

export interface ContenedorAppProps {
  children: ReactNode;
}

/**
 * Marco de la app.
 *
 * En teléfono (o ventana angosta) es columna centrada de 420 px sobre fondo
 * gris. En escritorio ocupa todo el espacio que le deja el sidebar: la misma
 * pantalla sirve en los dos shells sin tocar su contenido.
 */
export function ContenedorApp({ children }: ContenedorAppProps) {
  const { esDesktop, ancho } = useResponsive();

  if (esDesktop) {
    return <View style={estilos.escritorio}>{children}</View>;
  }

  return (
    <View style={estilos.exterior}>
      <View style={[estilos.columna, ancho >= 600 && { maxWidth: 640 }]}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  exterior: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
  },
  columna: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    backgroundColor: colores.fondo,
  },
  escritorio: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
});

import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, esWeb } from '../theme/tokens';

export interface ContenedorAppProps {
  children: ReactNode;
}

/**
 * Marco de la app.
 *
 * En el teléfono ocupa toda la pantalla. En el navegador se ve como una columna
 * centrada de 420 px sobre fondo gris: la app es móvil y no se estira a 1440 px
 * como el backoffice. Así el mismo código se ve igual en PC y en el celular.
 */
export function ContenedorApp({ children }: ContenedorAppProps) {
  return (
    <View style={estilos.exterior}>
      <View style={estilos.columna}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  exterior: {
    flex: 1,
    backgroundColor: esWeb ? colores.fondoExterior : colores.fondo,
    alignItems: 'center',
  },
  columna: {
    flex: 1,
    width: '100%',
    maxWidth: esWeb ? 420 : undefined,
    backgroundColor: colores.fondo,
    borderLeftWidth: esWeb ? 1 : 0,
    borderRightWidth: esWeb ? 1 : 0,
    borderColor: colores.linea,
  },
});

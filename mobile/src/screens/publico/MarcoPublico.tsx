import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { useResponsive } from '../../theme/responsive';
import { colores } from '../../theme/tokens';
import { PanelMarcaPublico } from './PanelMarcaPublico';

export interface MarcoPublicoProps {
  children: ReactNode;
  onVolver?: () => void;
  volverTexto?: string;
  destacados?: string[];
}

/**
 * Marco de las pantallas públicas (elegir cuenta, registro).
 *
 * En el teléfono es la columna de 420 px de siempre; en escritorio, el panel de
 * marca a la izquierda y el contenido a la derecha, igual que el login W63.
 */
export function MarcoPublico({
  children,
  onVolver,
  volverTexto,
  destacados,
}: MarcoPublicoProps) {
  const { esDesktop } = useResponsive();

  if (!esDesktop) {
    return <ContenedorApp>{children}</ContenedorApp>;
  }

  return (
    <View style={estilos.raiz}>
      <PanelMarcaPublico
        onVolver={onVolver}
        volverTexto={volverTexto}
        destacados={destacados}
      />
      <SafeAreaView style={estilos.lado}>{children}</SafeAreaView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colores.superficie,
  },
  lado: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
});

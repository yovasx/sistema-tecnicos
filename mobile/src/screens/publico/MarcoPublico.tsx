import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Texto } from '../../ui/Texto';
import { colores } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

export interface MarcoPublicoProps {
  children: ReactNode;
  onVolver?: () => void;
  volverTexto?: string;
  destacados?: string[];
}

/** Cabecera discreta y contenido fluido; sin paneles vacíos ni marcos de dispositivo. */
export function MarcoPublico({ children }: MarcoPublicoProps) {
  const { esDesktop } = useResponsive();
  return (
    <SafeAreaView style={s.raiz} edges={['top', 'left', 'right']}>
      <View style={[s.cabecera, esDesktop && s.cabeceraDesktop]}>
        <Texto variante="titulo" color={colores.marca}>Fixly<Texto color={colores.marca}>.</Texto></Texto>
        <Texto variante="caption" color={colores.terciario}>La Paz, Bolivia</Texto>
      </View>
      <View style={s.contenido}>{children}</View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  cabecera: { minHeight: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colores.superficie, borderBottomWidth: 1, borderColor: colores.linea },
  cabeceraDesktop: { paddingHorizontal: 48, minHeight: 72 },
  contenido: { flex: 1, minHeight: 0 },
});

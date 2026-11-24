import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContenedorApp } from './ContenedorApp';
import { useResponsive } from '../theme/responsive';

export function MarcoContenido({ children }: { children: ReactNode }) {
  const { esDesktop } = useResponsive();
  const contenido = <View style={{ width: '100%', maxWidth: 1080, gap: 20 }}>{children}</View>;
  return esDesktop ? contenido : <ContenedorApp><SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
      {contenido}
    </ScrollView>
  </SafeAreaView></ContenedorApp>;
}

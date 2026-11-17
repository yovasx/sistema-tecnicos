import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarcoPublico } from '../publico/MarcoPublico';
import { Texto } from '../../ui/Texto';
import { colores, sombraTarjeta } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

export function MarcoAuth({ children, onVolver }: { children: ReactNode; onVolver?: () => void }) {
  const { esDesktop } = useResponsive();
  return <MarcoPublico>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <View style={[s.caja, esDesktop && s.tarjeta]}>
          {onVolver ? <Pressable accessibilityRole="button" onPress={onVolver} style={s.volver}>
            <Ionicons name="arrow-back" size={18} color={colores.secundario} />
            <Texto variante="etiqueta" color={colores.secundario}>Volver</Texto>
          </Pressable> : null}
          {children}
        </View>
        <Texto variante="caption" color={colores.terciario} centrado>Fixly · Servicios técnicos en La Paz</Texto>
      </ScrollView>
    </KeyboardAvoidingView>
  </MarcoPublico>;
}
const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 28 },
  caja: { width: '100%', maxWidth: 420, gap: 20 },
  tarjeta: { padding: 32, maxWidth: 440, borderRadius: 20, backgroundColor: colores.superficie,
    borderWidth: 1, borderColor: colores.linea, ...sombraTarjeta },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 32 },
});

import { Pressable, StyleSheet, View } from 'react-native';
import { colores } from '../../theme/tokens';
import { Texto } from '../Texto';

/** Selector explícito, accesible por teclado y sin dependencias nativas. */
export function FiltroAdmin({ etiqueta, valor, opciones, onChange, deshabilitado = false }: {
  etiqueta: string; valor: string; opciones: readonly (readonly [string, string])[];
  onChange: (valor: string) => void; deshabilitado?: boolean;
}) {
  return <View style={s.grupo}>
    <Texto variante="caption">{etiqueta}</Texto>
    <View style={s.opciones}>
      {opciones.map(([id, texto]) => <Pressable key={id} accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${texto}`} accessibilityState={{ selected: id === valor }}
        disabled={deshabilitado} onPress={() => onChange(id)}
        style={({ pressed }) => [s.boton, id === valor && s.activo, pressed && { opacity: 0.75 }]}>
        <Texto variante="etiqueta" color={id === valor ? colores.marcaFuerte : colores.secundario}>{texto}</Texto>
      </Pressable>)}
    </View>
  </View>;
}
const s = StyleSheet.create({
  grupo: { gap: 8 }, opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  boton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.superficie },
  activo: { borderColor: colores.marca, backgroundColor: colores.marcaSuave },
});

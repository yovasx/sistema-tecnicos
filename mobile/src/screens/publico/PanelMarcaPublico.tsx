import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Texto } from '../../ui/Texto';
import { colores, espacio } from '../../theme/tokens';

export interface PanelMarcaPublicoProps {
  onVolver?: () => void;
  volverTexto?: string;
  /** Bullets de valor a la izquierda del formulario. */
  destacados?: string[];
}

/**
 * Panel azul de marca que acompaña a los formularios públicos de escritorio.
 * En el teléfono no se muestra: ahí la pantalla es de columna única.
 */
export function PanelMarcaPublico({
  onVolver,
  volverTexto = 'Volver al inicio',
  destacados = [],
}: PanelMarcaPublicoProps) {
  return (
    <View style={estilos.marca}>
      <View style={estilos.marcaTop}>
        {onVolver ? (
          <Texto onPress={onVolver} variante="etiqueta" color="#DCE7FF">
            ← {volverTexto}
          </Texto>
        ) : null}
        <View style={estilos.marcaArriba}>
          <Ionicons name="build" size={22} color={colores.superficie} />
          <Texto variante="titulo" color={colores.superficie}>
            Fixly
          </Texto>
        </View>
      </View>

      <View style={estilos.marcaCentro}>
        <Texto variante="display" color={colores.superficie}>
          La Paz, Bolivia
        </Texto>
        <Texto variante="cuerpo" color="#DCE7FF">
          Servicios técnicos verificados para el hogar.
        </Texto>
        {destacados.length > 0 ? (
          <View style={estilos.destacados}>
            {destacados.map((texto) => (
              <View key={texto} style={estilos.destacado}>
                <Ionicons name="checkmark-circle" size={18} color="#A6F4C5" />
                <Texto variante="caption" color="#DCE7FF">
                  {texto}
                </Texto>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={estilos.marcaAbajo}>
        <Ionicons name="help-circle-outline" size={18} color={colores.superficie} />
        <Texto variante="caption" color="#DCE7FF">
          Soporte: soporte@fixly.bo
        </Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: {
    flex: 1,
    backgroundColor: colores.marcaFuerte,
    padding: espacio.xxl,
    justifyContent: 'space-between',
  },
  marcaTop: {
    gap: espacio.base,
  },
  marcaArriba: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  marcaCentro: {
    gap: espacio.md,
  },
  destacados: {
    gap: espacio.sm,
    marginTop: espacio.sm,
  },
  destacado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  marcaAbajo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
});

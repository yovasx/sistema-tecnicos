import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colores, fuentes, radio, tamanos } from '../theme/tokens';
import { Texto } from './Texto';

export interface BotonPrimarioProps {
  titulo: string;
  onPress: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
  variante?: 'primario' | 'secundario';
  /** El design system pide 52 px en móvil y 40 px en escritorio. */
  tamano?: 'movil' | 'escritorio';
}

/**
 * CTA de la app: 52 px de alto, radio 12. Es el único botón grande; los
 * enlaces y acciones secundarias no compiten con él.
 */
export function BotonPrimario({
  titulo,
  onPress,
  cargando = false,
  deshabilitado = false,
  variante = 'primario',
  tamano = 'movil',
}: BotonPrimarioProps) {
  const inactivo = deshabilitado || cargando;
  const secundario = variante === 'secundario';
  const [enfocado, setEnfocado] = useState(false);
  const [hover, setHover] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={onPress}
      onFocus={() => setEnfocado(true)}
      onBlur={() => setEnfocado(false)}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => [
        estilos.base,
        tamano === 'escritorio' ? estilos.escritorio : null,
        secundario ? estilos.secundario : estilos.primario,
        pressed && !inactivo ? estilos.presionado : null,
        inactivo ? estilos.inactivo : null,
        hover && !inactivo && !secundario ? { backgroundColor: colores.marcaFuerte } : null,
        enfocado && Platform.OS === 'web' ? { outlineColor: colores.marca, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 3 } as never : null,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={secundario ? colores.marca : colores.superficie} />
      ) : (
        <View style={estilos.contenido}>
          <Texto
            numberOfLines={1}
            style={[estilos.titulo, secundario ? estilos.tituloSecundario : null]}
          >
            {titulo}
          </Texto>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radio.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  escritorio: {
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primario: {
    backgroundColor: colores.marca,
  },
  secundario: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.lineaFuerte,
  },
  presionado: {
    opacity: 0.88,
  },
  inactivo: {
    opacity: 0.55,
  },
  contenido: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titulo: {
    flexShrink: 1,
    fontFamily: fuentes.etiqueta,
    fontSize: tamanos.cuerpo,
    color: colores.superficie,
  },
  tituloSecundario: {
    color: colores.tinta,
  },
});

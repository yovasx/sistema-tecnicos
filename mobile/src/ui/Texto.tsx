import { StyleSheet, Text, TextProps } from 'react-native';
import { colores, fuentes, tamanos } from '../theme/tokens';

export type VarianteTexto =
  | 'display'
  | 'titulo'
  | 'subtitulo'
  | 'cuerpo'
  | 'cuerpoFuerte'
  | 'etiqueta'
  | 'caption';

export interface TextoProps extends TextProps {
  variante?: VarianteTexto;
  color?: string;
  centrado?: boolean;
}

/** Texto del sistema: siempre usa Hanken Grotesk o Inter, nunca la fuente nativa. */
export function Texto({
  variante = 'cuerpo',
  color,
  centrado,
  style,
  ...rest
}: TextoProps) {
  return (
    <Text
      {...rest}
      style={[
        estilos[variante],
        color ? { color } : null,
        centrado ? estilos.centrado : null,
        style,
      ]}
    />
  );
}

const estilos = StyleSheet.create({
  display: {
    fontFamily: fuentes.display,
    fontSize: tamanos.display,
    lineHeight: 36,
    color: colores.tinta,
    letterSpacing: -0.4,
  },
  titulo: {
    fontFamily: fuentes.titulo,
    fontSize: tamanos.titulo,
    lineHeight: 30,
    color: colores.tinta,
    letterSpacing: -0.2,
  },
  subtitulo: {
    fontFamily: fuentes.subtitulo,
    fontSize: tamanos.subtitulo,
    lineHeight: 24,
    color: colores.tinta,
  },
  cuerpo: {
    fontFamily: fuentes.cuerpo,
    fontSize: tamanos.cuerpo,
    lineHeight: 22,
    color: colores.tinta,
  },
  cuerpoFuerte: {
    fontFamily: fuentes.cuerpoMedio,
    fontSize: tamanos.cuerpo,
    lineHeight: 22,
    color: colores.tinta,
  },
  etiqueta: {
    fontFamily: fuentes.etiqueta,
    fontSize: tamanos.pequeno,
    lineHeight: 20,
    color: colores.tinta,
  },
  caption: {
    fontFamily: fuentes.cuerpo,
    fontSize: tamanos.caption,
    lineHeight: 16,
    color: colores.secundario,
  },
  centrado: {
    textAlign: 'center',
  },
});

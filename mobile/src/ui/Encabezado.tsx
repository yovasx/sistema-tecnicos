import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../theme/tokens';
import { Texto } from './Texto';

export interface EncabezadoProps {
  titulo: string;
  subtitulo?: string;
  derecha?: ReactNode;
}

/** Encabezado de pantalla: título Hanken + subtítulo corto. */
export function Encabezado({ titulo, subtitulo, derecha }: EncabezadoProps) {
  return (
    <View style={estilos.fila}>
      <View style={estilos.textos}>
        <Texto variante="titulo">{titulo}</Texto>
        {subtitulo ? (
          <Texto variante="caption" color={colores.secundario}>
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      {derecha}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: espacio.md,
  },
  textos: {
    flex: 1,
    gap: 4,
  },
});

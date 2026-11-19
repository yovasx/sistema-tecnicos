import { StyleSheet, View } from 'react-native';
import { colores, fuentes, radio, tamanos } from '../theme/tokens';
import { Texto } from './Texto';

export type TonoChip = 'neutro' | 'marca' | 'exito' | 'advertencia';

export interface ChipProps {
  texto: string;
  tono?: TonoChip;
}

const tonos: Record<TonoChip, { fondo: string; texto: string; borde: string }> = {
  neutro: { fondo: colores.fondo, texto: colores.secundario, borde: colores.linea },
  marca: { fondo: colores.marcaSuave, texto: colores.marcaFuerte, borde: colores.marcaSuave },
  exito: { fondo: colores.exitoSuave, texto: colores.exito, borde: colores.exitoSuave },
  advertencia: {
    fondo: colores.advertenciaSuave,
    texto: colores.advertencia,
    borde: colores.advertenciaLinea,
  },
};

/** Etiqueta compacta para estado, rol o perfil. */
export function Chip({ texto, tono = 'neutro' }: ChipProps) {
  const paleta = tonos[tono];
  return (
    <View style={[estilos.chip, { backgroundColor: paleta.fondo, borderColor: paleta.borde }]}>
      <Texto style={[estilos.texto, { color: paleta.texto }]}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radio.chip,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  texto: {
    fontFamily: fuentes.etiqueta,
    fontSize: tamanos.caption,
    lineHeight: 16,
  },
});

import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radio } from '../theme/tokens';
import { Texto } from './Texto';

export type TonoAviso = 'info' | 'advertencia' | 'peligro' | 'exito';

export interface AvisoProps {
  tono?: TonoAviso;
  titulo?: string;
  children: ReactNode;
}

const paletas: Record<
  TonoAviso,
  { fondo: string; borde: string; titulo: string }
> = {
  info: { fondo: colores.infoSuave, borde: colores.infoLinea, titulo: colores.info },
  advertencia: {
    fondo: colores.advertenciaSuave,
    borde: colores.advertenciaLinea,
    titulo: colores.advertencia,
  },
  peligro: { fondo: colores.peligroSuave, borde: colores.peligroLinea, titulo: colores.peligro },
  exito: { fondo: colores.exitoSuave, borde: colores.exitoSuave, titulo: colores.exito },
};

/** Banner del sistema. El ámbar queda reservado para "pendiente de V2". */
export function Aviso({ tono = 'info', titulo, children }: AvisoProps) {
  const paleta = paletas[tono];
  return (
    <View
      accessibilityRole="alert"
      style={[estilos.caja, { backgroundColor: paleta.fondo, borderColor: paleta.borde }]}
    >
      {titulo ? (
        <Texto variante="etiqueta" color={paleta.titulo}>
          {titulo}
        </Texto>
      ) : null}
      <Texto variante="caption" color={colores.secundario} style={estilos.texto}>
        {children}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    borderRadius: radio.control,
    borderWidth: 1,
    paddingHorizontal: espacio.base,
    paddingVertical: espacio.md,
    gap: 4,
  },
  texto: {
    lineHeight: 19,
  },
});

import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * Design system Fixly Blue.
 *
 * Una sola fuente de verdad para colores, tipografía, espaciado y radios.
 * Las pantallas no deberían escribir hex sueltos: si un color no está acá, no
 * pertenece al sistema.
 */
export const colores = {
  marca: '#2F6BFF',
  marcaFuerte: '#1456F0',
  marcaSuave: '#E8EFFF',
  acento: '#F97316', // solo urgencia
  acentoSuave: '#FFF4ED',

  tinta: '#101828',
  secundario: '#475467',
  terciario: '#667085',
  deshabilitado: '#98A2B3',

  linea: '#E1E6EF',
  lineaFuerte: '#D0D5DD',

  fondo: '#F5F7FB',
  superficie: '#FFFFFF',
  fondoExterior: '#DDE3EC',

  exito: '#067647',
  exitoSuave: '#ECFDF3',
  advertencia: '#B54708',
  advertenciaSuave: '#FFFAEB',
  advertenciaLinea: '#FEDF89',
  peligro: '#B42318',
  peligroSuave: '#FEF3F2',
  peligroLinea: '#FDA29B',
  info: '#175CD3',
  infoSuave: '#EFF8FF',
  infoLinea: '#B2DDFF',
} as const;

export const espacio = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radio = {
  tarjeta: 16,
  control: 12,
  chip: 999,
} as const;

export const fuentes = {
  display: 'HankenGrotesk_700Bold',
  titulo: 'HankenGrotesk_600SemiBold',
  subtitulo: 'HankenGrotesk_500Medium',
  cuerpo: 'Inter_400Regular',
  cuerpoMedio: 'Inter_500Medium',
  etiqueta: 'Inter_600SemiBold',
} as const;

export const tamanos = {
  display: 30,
  titulo: 24,
  subtitulo: 18,
  cuerpo: 16,
  pequeno: 14,
  caption: 12,
} as const;

export const esWeb = Platform.OS === 'web';

export const sombraTarjeta: ViewStyle = esWeb
  ? ({ boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 8px 24px rgba(16,24,40,0.06)' } as ViewStyle)
  : {
      shadowColor: colores.tinta,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    };

export const textoBase: TextStyle = {
  fontFamily: fuentes.cuerpo,
  fontSize: tamanos.cuerpo,
  color: colores.tinta,
  lineHeight: 22,
};

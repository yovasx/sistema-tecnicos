import { Texto } from '../Texto';
import { Tarjeta } from '../Tarjeta';
import { colores, espacio } from '../../theme/tokens';

export interface TarjetaMetricaProps {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tono?: 'neutro' | 'marca' | 'exito' | 'advertencia';
}

/** Card de métrica del tablero: etiqueta, valor grande y detalle opcional. */
export function TarjetaMetrica({ etiqueta, valor, detalle, tono = 'neutro' }: TarjetaMetricaProps) {
  const borde =
    tono === 'marca' ? colores.marca : tono === 'exito' ? colores.exito : tono === 'advertencia' ? colores.advertencia : colores.linea;

  return (
    <Tarjeta relleno={espacio.base} style={{ borderLeftWidth: 3, borderLeftColor: borde }}>
      <Texto variante="etiqueta" color={colores.secundario}>
        {etiqueta}
      </Texto>
      <Texto variante="display" style={{ fontSize: 28, lineHeight: 34 }}>
        {valor}
      </Texto>
      {detalle ? (
        <Texto variante="caption" color={colores.secundario}>
          {detalle}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

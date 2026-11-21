import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colores, fuentes, tamanos } from '../../theme/tokens';

export interface ColumnaTabla {
  clave: string;
  titulo: string;
  /** Ancho fijo en px; si se omite, la columna reparte el espacio restante. */
  ancho?: number;
}

/**
 * Tabla de escritorio: header sticky de 44 px, filas de 56 px, borders suaves.
 * Los datos los pasa la pantalla ya formateados a texto (Bs 65,00, fechas,
 * chips no caben aquí: van como texto).
 */
export function Tabla({
  columnas,
  filas,
  vacio,
}: {
  columnas: ColumnaTabla[];
  filas: string[][];
  vacio?: ReactNode;
}) {
  return (
    <View style={estilos.caja}>
      <View style={estilos.header}>
        {columnas.map((c) => (
          <Text key={c.clave} style={[estilos.headerTexto, anchoDe(c)]}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {filas.length === 0 ? (
        vacio ?? <Text style={estilos.vacio}>Sin datos todavía.</Text>
      ) : (
        filas.map((fila, i) => (
          <View key={i} style={[estilos.fila, i % 2 === 1 && estilos.filaAlt]}>
            {fila.map((celda, j) => (
              <Text
                key={j}
                style={[estilos.celda, anchoDe(columnas[j])]}
                numberOfLines={1}
              >
                {celda}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function anchoDe(columna: ColumnaTabla | undefined) {
  return columna?.ancho ? { width: columna.ancho } : { flex: 1 };
}

const estilos = StyleSheet.create({
  caja: {
    backgroundColor: colores.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.linea,
    overflow: 'hidden',
  },
  header: {
    height: 44,
    flexDirection: 'row',
    backgroundColor: colores.fondo,
    borderBottomWidth: 1,
    borderBottomColor: colores.lineaFuerte,
  },
  headerTexto: {
    fontFamily: fuentes.etiqueta,
    fontSize: tamanos.caption,
    color: colores.secundario,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    textAlignVertical: 'center',
    lineHeight: 44,
  },
  fila: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colores.linea,
  },
  filaAlt: {
    backgroundColor: '#FAFBFD',
  },
  celda: {
    fontFamily: fuentes.cuerpo,
    fontSize: tamanos.pequeno,
    color: colores.tinta,
    paddingHorizontal: 12,
  },
  vacio: {
    fontFamily: fuentes.cuerpo,
    fontSize: tamanos.pequeno,
    color: colores.terciario,
    padding: 24,
  },
});

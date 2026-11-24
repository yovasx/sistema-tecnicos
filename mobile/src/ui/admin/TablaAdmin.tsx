import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colores } from '../../theme/tokens';
import { Texto } from '../Texto';
import { BotonPrimario } from '../BotonPrimario';

export interface ColumnaAdmin<T> { clave: string; titulo: string; ancho?: number; render: (fila: T) => ReactNode }

/** Tabla con celdas ricas y scroll confinado; la página se consulta en servidor. */
export function TablaAdmin<T>({ columnas, filas, clave, pagina, tamano, total, ocupado, onPagina, anchoMinimo = 880 }: {
  columnas: ColumnaAdmin<T>[]; filas: T[]; clave: (fila: T) => string;
  pagina: number; tamano: number; total: number; ocupado: boolean; onPagina: (pagina: number) => void;
  anchoMinimo?: number;
}) {
  return <View style={s.caja}>
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ minWidth: anchoMinimo, flex: 1 }} accessibilityRole="table">
        <View style={s.cabecera} accessibilityRole="row">
          {columnas.map(c => <View key={c.clave} style={[s.celda, c.ancho ? { width: c.ancho } : { flex: 1, minWidth: 220 }]}
            accessibilityRole="columnheader"><Texto variante="caption">{c.titulo}</Texto></View>)}
        </View>
        {filas.map(f => <View key={clave(f)} style={s.fila} accessibilityRole="row">
          {columnas.map(c => <View key={c.clave} accessibilityRole="cell"
            style={[s.celda, c.ancho ? { width: c.ancho } : { flex: 1, minWidth: 220 }]}>{c.render(f)}</View>)}
        </View>)}
        {!filas.length ? <View style={s.vacio}><Texto variante="subtitulo">Sin resultados</Texto>
          <Texto color={colores.secundario}>Intenta con otra búsqueda o quita los filtros.</Texto></View> : null}
      </View>
    </ScrollView>
    <View style={s.pie}>
      <Texto variante="caption">{total ? `${pagina * tamano + 1}–${Math.min((pagina + 1) * tamano, total)} de ${total} resultados` : '0 resultados'}</Texto>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <BotonPrimario titulo="Anterior" tamano="escritorio" variante="secundario"
          deshabilitado={ocupado || pagina === 0} onPress={() => onPagina(pagina - 1)} />
        <Texto variante="caption">Página {pagina + 1}</Texto>
        <BotonPrimario titulo="Siguiente" tamano="escritorio" variante="secundario"
          deshabilitado={ocupado || (pagina + 1) * tamano >= total} onPress={() => onPagina(pagina + 1)} />
      </View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  caja: { borderWidth: 1, borderColor: colores.linea, borderRadius: 16, overflow: 'hidden', backgroundColor: colores.superficie },
  cabecera: { flexDirection: 'row', minHeight: 44, backgroundColor: colores.fondo, alignItems: 'center' },
  fila: { flexDirection: 'row', minHeight: 78, borderTopWidth: 1, borderColor: colores.linea, alignItems: 'center' },
  celda: { padding: 14, gap: 4 }, vacio: { padding: 32, gap: 8 },
  pie: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'center',
    borderTopWidth: 1, borderColor: colores.linea },
});

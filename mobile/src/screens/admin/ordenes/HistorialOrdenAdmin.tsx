import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PaginaOrdenes, TransicionOrdenAdmin } from '../../../domain/models/OrdenAdmin';
import { ordenesAdminRepository as repo } from '../../../infrastructure/di';
import { colores } from '../../../theme/tokens';
import { Aviso } from '../../../ui/Aviso';
import { BotonPrimario } from '../../../ui/BotonPrimario';
import { Tarjeta } from '../../../ui/Tarjeta';
import { Texto } from '../../../ui/Texto';
import { errorOrden, EstadoOrden, fechaOrden, PersonaResumenOrden } from './presentacionOrden';

export function HistorialOrdenAdmin({ id, recarga }: { id: number; recarga: number }) {
  const [pagina, setPagina] = useState(0);
  const [reintento, setReintento] = useState(0);
  const [datos, setDatos] = useState<PaginaOrdenes<TransicionOrdenAdmin> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const consulta = useRef(0);
  useEffect(() => {
    const actual = ++consulta.current; setCargando(true); setError('');
    repo.historial(id, pagina).then(d => { if (actual === consulta.current) setDatos(d); })
      .catch(e => { if (actual === consulta.current) { setError(errorOrden(e)); setDatos(null); } })
      .finally(() => { if (actual === consulta.current) setCargando(false); });
    return () => { consulta.current++; };
  }, [id, pagina, recarga, reintento]);
  return <Tarjeta style={{ gap: 24 }}>
    <View style={s.entre}><Texto variante="subtitulo">Historial de estados</Texto>
      <BotonPrimario titulo="Actualizar historial de orden" variante="secundario" tamano="escritorio" deshabilitado={cargando}
        onPress={() => setReintento(n => n + 1)} /></View>
    <Texto variante="caption">Más recientes primero · horario de Bolivia · solo transiciones registradas, sin reconstruir eventos.</Texto>
    {error ? <Aviso tono="peligro" titulo="No pudimos cargar el historial">{error} Usa Actualizar historial de orden para reintentar.</Aviso> : null}
    {cargando ? <ActivityIndicator color={colores.marca} /> : !error && datos ? <>
      {!datos.elementos.length ? <Aviso>{datos.total ? 'No hay registros en esta página. Vuelve a la anterior.' : 'No hay transiciones registradas para esta orden.'}</Aviso> : null}
      {datos.elementos.map(h => <View key={h.id} style={s.evento}>
        <View style={s.marca} />
        <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
          <View style={s.entre}>
            <View style={s.fila}>{h.estadoAnterior ? <><EstadoOrden estado={h.estadoAnterior} /><Texto variante="caption">→</Texto></> :
              <Texto variante="etiqueta">Registro inicial</Texto>}<EstadoOrden estado={h.estadoNuevo} /></View>
            <Texto variante="caption">{fechaOrden(h.registradoEn)}</Texto>
          </View>
          <PersonaResumenOrden persona={h.autor} sinDato="Actor no registrado" />
          {h.observacion ? <Texto>{h.observacion}</Texto> : null}
        </View>
      </View>)}
      <View style={s.entre}><Texto variante="caption">{datos.total} transiciones · página {datos.pagina + 1}</Texto>
        <View style={s.fila}><BotonPrimario titulo="Historial anterior" variante="secundario" tamano="escritorio"
          deshabilitado={datos.pagina === 0} onPress={() => setPagina(p => p - 1)} />
          <BotonPrimario titulo="Historial siguiente" variante="secundario" tamano="escritorio"
            deshabilitado={(datos.pagina + 1) * datos.tamano >= datos.total} onPress={() => setPagina(p => p + 1)} /></View></View>
    </> : null}
  </Tarjeta>;
}
const s = StyleSheet.create({
  entre: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  evento: { flexDirection: 'row', gap: 16, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colores.linea },
  marca: { width: 10, height: 10, borderRadius: 5, backgroundColor: colores.marca, marginTop: 8 },
});

import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { operacionRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { fechaHoraBolivia } from '../../ui/formato';
import { estadoServicio } from '../cliente/estadosServicio';
import { EstadoServicio } from '../../domain/models/SolicitudServicio';
import { ServicioTecnicoDetalle } from './ServicioTecnicoDetalle';

export function ServiciosTecnico() {
  const [pagina, setPagina] = useState(0);
  const [id, setId] = useState<number | null>(null);
  const c = useConsulta(() => operacionRepository.servicios(pagina), [pagina]);
  if (id) return <ServicioTecnicoDetalle id={id} onVolver={() => { setId(null); c.actualizar(); }} />;
  return <MarcoContenido>
    <Encabezado titulo="Mis servicios" subtitulo="Tus órdenes asignadas, atención e historial." />
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar servicios" variante="secundario" deshabilitado={c.cargando} onPress={c.actualizar} />
    {c.cargando ? <ActivityIndicator /> : null}
    {!c.cargando && !c.error && !c.datos?.elementos.length ? <Tarjeta><Texto>No tienes servicios asignados en esta página.</Texto></Tarjeta> : null}
    {!c.cargando ? c.datos?.elementos.map(s => <Tarjeta key={s.id} style={{ gap: 12 }}>
      <Texto variante="subtitulo">Servicio #{s.id} · {s.categoria}</Texto>
      <Texto>{estadoServicio(s.estado as EstadoServicio).texto} · {fechaHoraBolivia(s.creadoEn)}</Texto>
      <BotonPrimario titulo={`Abrir servicio ${s.id}`} variante="secundario" onPress={() => setId(s.id)} />
    </Tarjeta>) : null}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <BotonPrimario titulo="Anterior" variante="secundario" deshabilitado={pagina === 0 || c.cargando} onPress={() => setPagina(p => p - 1)} />
      <BotonPrimario titulo="Siguiente" variante="secundario" deshabilitado={!c.datos || (pagina + 1) * 20 >= c.datos.total || c.cargando}
        onPress={() => setPagina(p => p + 1)} />
    </View>
  </MarcoContenido>;
}

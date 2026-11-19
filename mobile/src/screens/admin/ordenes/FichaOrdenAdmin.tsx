import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ContactoOrden, DetalleOrdenAdmin } from '../../../domain/models/OrdenAdmin';
import { ordenesAdminRepository as repo } from '../../../infrastructure/di';
import { abrirMapaOrden } from '../../../infrastructure/navigation/abrirMapaOrden';
import { useResponsive } from '../../../theme/responsive';
import { colores } from '../../../theme/tokens';
import { Aviso } from '../../../ui/Aviso';
import { BotonPrimario } from '../../../ui/BotonPrimario';
import { Chip } from '../../../ui/Chip';
import { Encabezado } from '../../../ui/Encabezado';
import { Tarjeta } from '../../../ui/Tarjeta';
import { Texto } from '../../../ui/Texto';
import { FiltroAdmin } from '../../../ui/admin/FiltroAdmin';
import { HistorialOrdenAdmin } from './HistorialOrdenAdmin';
import { errorOrden, EstadoOrden, fechaOrden, PersonaResumenOrden } from './presentacionOrden';

export function FichaOrdenAdmin({ id, onVolver }: { id: number; onVolver: () => void }) {
  const { ancho } = useResponsive();
  const [d, setDetalle] = useState<DetalleOrdenAdmin | null>(null);
  const [vista, setVista] = useState('resumen');
  const [error, setError] = useState('');
  const [errorMapa, setErrorMapa] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const consulta = useRef(0);
  useEffect(() => {
    const actual = ++consulta.current; setCargando(true); setError(''); setErrorMapa('');
    repo.detalle(id).then(datos => { if (actual === consulta.current) setDetalle(datos); })
      .catch(e => { if (actual === consulta.current) { setDetalle(null); setError(errorOrden(e)); } })
      .finally(() => { if (actual === consulta.current) setCargando(false); });
    return () => { consulta.current++; };
  }, [id, recarga]);
  function mapa() {
    if (!d) return;
    setErrorMapa('');
    try { abrirMapaOrden(d.ubicacion.latitud, d.ubicacion.longitud); }
    catch (e) { setErrorMapa(errorOrden(e)); }
  }
  return <View style={s.raiz}>
    <View style={s.entre}><BotonPrimario titulo="Volver a Órdenes" variante="secundario" tamano="escritorio" onPress={onVolver} />
      <Texto variante="caption">Operación / Órdenes / #{id}</Texto></View>
    <Encabezado titulo={`Orden #${id}`} subtitulo="Detalle administrativo · solo lectura"
      derecha={<BotonPrimario titulo={error ? 'Reintentar ficha de orden' : 'Actualizar ficha de orden'} variante="secundario"
        tamano="escritorio" deshabilitado={cargando} onPress={() => setRecarga(n => n + 1)} />} />
    {error ? <Aviso tono="peligro" titulo="No pudimos consultar la orden">{error}</Aviso> : null}
    {cargando ? <View style={s.fila}><ActivityIndicator color={colores.marca} /><Texto variante="caption">Consultando ficha…</Texto></View> : null}
    {d && !cargando && !error ? <>
      <Tarjeta relleno={24} style={{ gap: 16 }}>
        <View style={s.entre}>
          <View style={s.fila}><View style={s.icono}><Ionicons name="receipt-outline" size={26} color={colores.marca} /></View>
            <View style={{ gap: 6 }}><Texto variante="subtitulo">{d.categoria.nombre}</Texto>
              <Texto variante="caption">Creada: {fechaOrden(d.creadoEn)}</Texto></View></View>
          <View style={s.fila}><EstadoOrden estado={d.estado} />
            {d.tarifaUrgencia ? <Chip texto="Urgencia registrada" tono="advertencia" /> : null}</View>
        </View>
        <Texto variante="caption">Última actualización registrada: {fechaOrden(d.actualizadoEn)} · horario de Bolivia</Texto>
      </Tarjeta>
      <FiltroAdmin etiqueta="Ficha de la orden" valor={vista} opciones={[['resumen', 'Resumen del servicio'], ['historial', 'Historial de estados']]}
        onChange={setVista} />
      {vista === 'resumen' ? <View style={{ flexDirection: ancho >= 1360 ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
        <View style={{ flex: 2, minWidth: 0, gap: 24, width: '100%' }}>
          <Tarjeta style={{ gap: 20 }}><Texto variante="subtitulo">Servicio solicitado</Texto>
            <DatoOrden etiqueta="Descripción de la falla" valor={d.descripcionFalla} />
            <DatoOrden etiqueta="Dirección de referencia" valor={d.direccionReferencia} />
            <Texto variante="caption">La urgencia es el indicador registrado en la orden; no representa un importe ni un plazo garantizado.</Texto>
          </Tarjeta>
          <Tarjeta style={{ gap: 20 }}><View style={s.fila}><Ionicons name="location-outline" size={22} color={colores.marca} />
            <Texto variante="subtitulo">Ubicación de la solicitud</Texto></View>
            <View style={s.fila}><DatoOrden etiqueta="Latitud" valor={String(d.ubicacion.latitud)} />
              <DatoOrden etiqueta="Longitud" valor={String(d.ubicacion.longitud)} /></View>
            <Aviso>Es el punto registrado para el servicio, no la posición actual del técnico. No hay seguimiento en vivo en esta vista.</Aviso>
            <Texto variante="caption">Al abrir OpenStreetMap se compartirán únicamente estas coordenadas con ese sitio externo.</Texto>
            <BotonPrimario titulo="Abrir ubicación en OpenStreetMap" variante="secundario" tamano="escritorio" onPress={mapa} />
            {errorMapa ? <Aviso tono="peligro">{errorMapa}</Aviso> : null}
          </Tarjeta>
          {d.cancelacion ? <Tarjeta style={{ gap: 16 }}><Texto variante="subtitulo">Cancelación registrada</Texto>
            <DatoOrden etiqueta="Motivo de cancelación" valor={d.cancelacion.motivo} />
            <DatoOrden etiqueta="Cancelada en" valor={fechaOrden(d.cancelacion.canceladoEn)} />
            <Texto variante="caption">Responsable registrado</Texto>
            <PersonaResumenOrden persona={d.cancelacion.autor} sinDato="Actor no registrado" />
          </Tarjeta> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 24, width: '100%' }}>
          <PersonaOrdenTarjeta titulo="Cliente" contacto={d.cliente} />
          <PersonaOrdenTarjeta titulo="Técnico asignado" contacto={d.tecnico} sinDato="Sin asignar" />
          <Tarjeta style={{ gap: 16 }}><Texto variante="subtitulo">Fechas registradas</Texto>
            <DatoOrden etiqueta="Asignación" valor={fechaOrden(d.asignadoEn)} />
            <DatoOrden etiqueta="Llegada estimada" valor={fechaOrden(d.llegadaEstimadaEn)} />
            <DatoOrden etiqueta="Llegada real" valor={fechaOrden(d.llegadaEn)} />
            <DatoOrden etiqueta="Finalización" valor={fechaOrden(d.finalizadoEn)} />
            <Texto variante="caption">Los campos sin registro no se estiman ni se reconstruyen.</Texto>
          </Tarjeta>
        </View>
      </View> : <HistorialOrdenAdmin id={id} recarga={recarga} />}
      <Aviso titulo="Vista de consulta">La asignación, las cotizaciones y los cambios de estado pertenecen al flujo operativo. No se fuerzan desde esta ficha.</Aviso>
    </> : null}
  </View>;
}
function PersonaOrdenTarjeta({ titulo, contacto, sinDato }: { titulo: string; contacto: ContactoOrden | null; sinDato?: string }) {
  return <Tarjeta style={{ gap: 16 }}><Texto variante="subtitulo">{titulo}</Texto>
    <PersonaResumenOrden persona={contacto?.persona ?? null} sinDato={sinDato} />
    {contacto && !contacto.persona.eliminada ? <>
      <DatoOrden etiqueta="Correo" valor={contacto.email} /><DatoOrden etiqueta="Teléfono" valor={contacto.telefono} />
      <Texto variante="caption">Datos actuales de la cuenta; no son una copia histórica del día de la orden.</Texto>
    </> : null}
  </Tarjeta>;
}
export function DatoOrden({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return <View style={{ gap: 4, minWidth: 0 }}><Texto variante="caption">{etiqueta}</Texto><Texto>{valor || 'Sin registro'}</Texto></View>;
}
const s = StyleSheet.create({
  raiz: { gap: 24 }, fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  entre: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  icono: { width: 52, height: 52, borderRadius: 14, backgroundColor: colores.marcaSuave, alignItems: 'center', justifyContent: 'center' },
});

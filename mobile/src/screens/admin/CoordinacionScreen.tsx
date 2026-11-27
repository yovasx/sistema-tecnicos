import { useState } from 'react';
import { View } from 'react-native';
import { gestionLocalRepository as repo } from '../../infrastructure/di';
import { useResponsive } from '../../theme/responsive';
import { useConsulta } from '../useConsulta';
import { AtencionLocal } from '../servicios/AtencionLocal';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Encabezado } from '../../ui/Encabezado';
import { CampoTexto } from '../../ui/CampoTexto';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { TablaAdmin } from '../../ui/admin/TablaAdmin';
import { fechaHoraBolivia } from '../../ui/formato';

const porcentaje = (n: number, d: number) => d ? `${(100 * n / d).toFixed(1)}% (${n}/${d})` : 'Sin muestra';
export function CoordinacionScreen() {
  const { esDesktop } = useResponsive();
  return esDesktop ? <Centro /> : <Aviso>Coordinación se utiliza desde el escritorio web.</Aviso>;
}
function Centro() {
  const c = useConsulta(() => repo.panel());
  const [orden, setOrden] = useState<number | null>(null);
  const [edicion, setEdicion] = useState(false);
  const [buscarOrden, setBuscarOrden] = useState('');
  const i = c.datos?.indicadores;
  return <View style={{ gap: 20 }}>
    <Encabezado titulo="Coordinación de atenciones" subtitulo="Una empresa local: asignación, continuidad y cierre responsable." />
    <BotonPrimario titulo="Actualizar centro de coordinación" variante="secundario" deshabilitado={c.cargando || edicion} onPress={c.actualizar} />
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    {i ? <>
      <Texto variante="caption">Cohorte de solicitudes creadas entre {fechaHoraBolivia(c.datos!.desde)} y {fechaHoraBolivia(c.datos!.hasta)}.</Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Metrica titulo="Solicitudes creadas" valor={String(i.creadas)} />
        <Metrica titulo="Finalizadas / creadas" valor={porcentaje(i.finalizadas, i.creadas)} />
        <Metrica titulo="Canceladas / creadas" valor={porcentaje(i.canceladas, i.creadas)} />
        <Metrica titulo="Aún sin asignar / creadas" valor={porcentaje(i.sinAsignacion, i.creadas)} />
        <Metrica titulo="Asignación promedio" valor={i.minutosAsignacion === null ? 'Sin muestra' : `${i.minutosAsignacion.toFixed(1)} min · ${i.asignadas} casos`} />
        <Metrica titulo="Llegada promedio desde asignación" valor={i.minutosLlegada === null ? 'Sin muestra' : `${i.minutosLlegada.toFixed(1)} min · ${i.llegadas} casos`} />
        <Metrica titulo="Cotizaciones aceptadas / respondidas" valor={porcentaje(i.cotizacionesAceptadas, i.cotizacionesRespondidas)} />
        <Metrica titulo="Órdenes cerradas con reclamo / cerradas" valor={porcentaje(i.disputas, i.cerradas)} />
      </View>
      <Texto variante="caption">Promedios solo con ambas fechas registradas. Cotizaciones: se cuentan versiones aceptadas o rechazadas,
        no borradores ni vencidas. Un reclamo no implica culpabilidad. Estas métricas no son SLA contractuales ni ingresos.</Texto>
    </> : null}
    <Texto variante="subtitulo">Hasta 50 atenciones que requieren seguimiento · todas las fechas</Texto>
    <CampoTexto etiqueta="Consultar otra orden por ID" value={buscarOrden} maxLength={12}
      editable={!edicion} onChangeText={v => setBuscarOrden(v.replace(/\D/g, ''))} />
    <BotonPrimario titulo="Abrir atención por ID" variante="secundario" deshabilitado={edicion || !Number(buscarOrden)}
      onPress={() => setOrden(Number(buscarOrden))} />
    {c.datos ? <TablaAdmin filas={c.datos.pendientes} clave={p => String(p.orden)}
      pagina={0} tamano={50} total={c.datos.pendientes.length} ocupado={edicion} onPagina={() => {}} anchoMinimo={760}
      columnas={[
        { clave: 'orden', titulo: 'ORDEN', ancho: 170, render: p => <Texto>#{p.orden} · {p.categoria}</Texto> },
        { clave: 'motivo', titulo: 'SITUACIÓN', render: p => <View style={{ gap: 4 }}><Texto>{p.motivo}</Texto>
          <Texto variante="caption">{p.estado.replaceAll('_', ' ')} · {fechaHoraBolivia(p.creadoEn)}</Texto></View> },
        { clave: 'abrir', titulo: 'ACCIÓN', ancho: 160, render: p => <BotonPrimario titulo="Gestionar atención"
          variante="secundario" tamano="escritorio" deshabilitado={edicion} onPress={() => setOrden(p.orden)} /> },
      ]} /> : null}
    {orden ? <View style={{ gap: 16 }}>
      <Texto variante="subtitulo">Gestión de orden #{orden}</Texto>
      <BotonPrimario titulo="Cerrar gestión de atención" variante="secundario" deshabilitado={edicion} onPress={() => setOrden(null)} />
      <AtencionLocal key={orden} orden={orden} modo="coordinacion" onCambio={c.actualizar} onEdicion={setEdicion} />
      <ExplicacionAsignacion key={`c${orden}`} orden={orden} />
    </View> : null}
    <Aviso>La empresa no cobra automáticamente por ausencia, cancelación o diagnóstico. Sin reparación autorizada,
      coordinación puede cerrar la orden con motivo. Para cambiar de técnico se cancela y se crea otra solicitud:
      no se sobrescriben asignaciones ni se pierden conversaciones anteriores.</Aviso>
  </View>;
}
function Metrica({ titulo, valor }: { titulo: string; valor: string }) {
  return <Tarjeta style={{ gap: 6, flexGrow: 1, flexBasis: 240 }}><Texto variante="caption">{titulo}</Texto><Texto variante="subtitulo">{valor}</Texto></Tarjeta>;
}
function ExplicacionAsignacion({ orden }: { orden: number }) {
  const c = useConsulta(() => repo.candidatos(orden), [orden]);
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">Asignación explicable</Texto>
    <Texto>Elegibilidad: especialidad, zona, cuenta habilitada, disponibilidad y ausencia de otra atención.
      Entre elegibles: distancia reciente si existe, reputación y mayor tiempo sin asignación; ID como último desempate.
      No se exige activar GPS fuera de un trayecto.</Texto>
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    {!c.cargando && !c.datos?.length ? <Texto>No hay técnicos habilitados con esta especialidad.</Texto> : null}
    {c.datos?.map(p => <View key={p.tecnico} style={{ gap: 4 }}>
      <Texto variante="cuerpoFuerte">{p.nombre} · {p.especialidad}</Texto>
      <Texto>Zona: {p.cobertura ? 'compatible' : 'fuera de cobertura'} · {p.disponible ? 'Disponible' : 'No disponible'} ·
        {p.sinServicio ? ' Sin otra atención' : ' Ya tiene atención'}</Texto>
      <Texto variante="caption">{p.distanciaMetros === null ? 'Sin distancia reciente; no se presume cercanía' : `${Math.round(p.distanciaMetros)} m geodésicos`}
        {' · '}Índice de reputación: {p.reputacion} · Última asignación: {p.ultimaAsignacion ? fechaHoraBolivia(p.ultimaAsignacion) : 'Sin asignaciones registradas'}</Texto>
    </View>)}
    <Texto variante="caption">Evaluación actual, no reconstrucción de una ubicación histórica. No son rutas viales ni una predicción de tráfico.</Texto>
  </Tarjeta>;
}

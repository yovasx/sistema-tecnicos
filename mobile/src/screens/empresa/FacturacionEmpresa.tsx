import { useState } from 'react';
import { View } from 'react-native';
import { solicitudesRepository, gestionLocalRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { bolivianos, fechaHoraBolivia } from '../../ui/formato';

/** Consulta real de autorizaciones, no facturación fiscal ni registro de cobros. */
export function FacturacionEmpresa() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [filtros, setFiltros] = useState<{ desde?: string; hasta?: string; sucursal?: number }>({});
  const [errorFiltros, setErrorFiltros] = useState('');
  const c = useConsulta(() => solicitudesRepository.facturacion(filtros), [filtros]);
  const sc = useConsulta(() => gestionLocalRepository.sucursales());
  function aplicar() {
    const valida = (v: string) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(`${v}T00:00:00Z`))
      && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v);
    if (!valida(desde) || !valida(hasta) || (desde && hasta && desde > hasta)) {
      setErrorFiltros('Revisa el período con fechas AAAA-MM-DD.'); return;
    }
    setErrorFiltros(''); setFiltros({ desde: desde || undefined, hasta: hasta || undefined, sucursal: sucursal ? Number(sucursal) : undefined });
  }
  return <MarcoContenido>
    <Encabezado titulo="Cotizaciones y costos autorizados"
      subtitulo="La cuenta empresarial representa al responsable que autoriza las cotizaciones de sus solicitudes." />
    <Aviso>Estos importes son autorizaciones de trabajo, no pagos ni facturas fiscales. No hay cobros electrónicos en esta versión.</Aviso>
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    {errorFiltros || sc.error ? <Aviso tono="advertencia">{errorFiltros || sc.error}</Aviso> : null}
    <Tarjeta style={{ gap: 12 }}>
      <Texto variante="subtitulo">Fecha de autorización · días de Bolivia incluidos</Texto>
      <CampoTexto etiqueta="Autorizadas desde (opcional)" value={desde} maxLength={10} placeholder="AAAA-MM-DD" onChangeText={setDesde} />
      <CampoTexto etiqueta="Autorizadas hasta (opcional)" value={hasta} maxLength={10} placeholder="AAAA-MM-DD" onChangeText={setHasta} />
      <FiltroAdmin etiqueta="Sucursal al solicitar" valor={sucursal}
        opciones={[['', 'Todas'], ...(sc.datos?.map(s => [String(s.id), s.nombre] as const) ?? [])]} onChange={setSucursal} />
      <BotonPrimario titulo="Aplicar filtros de costos" deshabilitado={c.cargando} onPress={aplicar} />
    </Tarjeta>
    <BotonPrimario titulo="Actualizar costos autorizados" variante="secundario" deshabilitado={c.cargando} onPress={c.actualizar} />
    {c.datos ? <>
      <Tarjeta style={{ gap: 8 }}><Texto variante="caption">Suma de la última cotización aceptada de cada orden · filtros aplicados</Texto>
        <Texto variante="display">{bolivianos(c.datos.totalAceptado)}</Texto>
        <Texto variante="caption">No representa deuda ni saldo pagado. Consulta el estado de cada orden, incluidas las canceladas.</Texto></Tarjeta>
      <Texto variante="subtitulo">Últimas 100 órdenes con cotización aceptada</Texto>
      {!c.datos.lineas.length ? <Texto>Todavía no hay cotizaciones aceptadas para tu empresa.</Texto> : null}
      {c.datos.lineas.map(l => <Tarjeta key={l.orden} style={{ gap: 8 }}>
        <Texto variante="cuerpoFuerte">Orden #{l.orden} · {l.categoria}</Texto>
        {l.equipo ? <Texto>{l.equipo}{l.sucursal ? ` · ${l.sucursal}` : ''}</Texto> : null}
        <View style={{ gap: 4 }}><Texto>{l.tecnico ?? 'Técnico no disponible'}</Texto>
          <Texto>{l.estadoOrden.replaceAll('_', ' ')} · {bolivianos(l.total)}</Texto>
          {l.aceptadaEn ? <Texto variante="caption">Autorizada: {fechaHoraBolivia(l.aceptadaEn)}</Texto> : null}</View>
      </Tarjeta>)}
    </> : null}
  </MarcoContenido>;
}

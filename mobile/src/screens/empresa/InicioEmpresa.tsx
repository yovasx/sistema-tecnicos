import { View } from 'react-native';
import { useSesion } from '../../session/SesionProvider';
import { useSolicitudServicio } from '../../session/SolicitudServicioProvider';
import { solicitudesRepository, gestionLocalRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Aviso } from '../../ui/Aviso';
import { bolivianos } from '../../ui/formato';

export function InicioEmpresa() {
  const { usuario } = useSesion();
  const { abrir } = useSolicitudServicio();
  const c = useConsulta(async () => ({
    ordenes: await solicitudesRepository.propias(0), costos: await solicitudesRepository.facturacion(),
    equipos: await gestionLocalRepository.equipos(), sucursales: await gestionLocalRepository.sucursales(),
  }));
  return <MarcoContenido>
    <Encabezado titulo={usuario?.razonSocial ?? usuario?.nombre ?? 'Mi empresa'}
      subtitulo={`Mantenimiento para tus instalaciones · NIT ${usuario?.nit ?? 'No registrado'}`} />
    <BotonPrimario titulo="Solicitar atención técnica" onPress={() => abrir()} />
    <Aviso>Tu cuenta es la responsable de autorizar cotizaciones. Organiza tus equipos por sucursal y conserva
      el historial de cada reparación. No se emiten facturas fiscales ni se confirman pagos desde este sistema.</Aviso>
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar resumen empresarial" variante="secundario" deshabilitado={c.cargando} onPress={c.actualizar} />
    {c.datos ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Tarjeta><Texto variante="display">{c.datos.ordenes.total}</Texto><Texto>Solicitudes registradas</Texto></Tarjeta>
        <Tarjeta><Texto variante="display">{c.datos.equipos.filter(e => e.activo).length}</Texto><Texto>Equipos activos</Texto></Tarjeta>
        <Tarjeta><Texto variante="display">{c.datos.sucursales.filter(s => s.activa).length}</Texto><Texto>Sucursales activas</Texto></Tarjeta>
      </View>
      <Tarjeta style={{ gap: 8 }}><Texto variante="subtitulo">{bolivianos(c.datos.costos.totalAceptado)}</Texto>
        <Texto>Cotizaciones autorizadas · todas las fechas · no equivale a pagos</Texto></Tarjeta>
      <Texto variante="subtitulo">Solicitudes recientes</Texto>
      {c.datos.ordenes.elementos.slice(0, 5).map(o => <Tarjeta key={o.id}>
        <Texto variante="cuerpoFuerte">#{o.id} · {o.categoria}</Texto><Texto>{o.estado.replaceAll('_', ' ')}</Texto>
      </Tarjeta>)}
      {!c.datos.ordenes.total ? <Texto>Tu empresa todavía no tiene solicitudes.</Texto> : null}
    </> : null}
  </MarcoContenido>;
}

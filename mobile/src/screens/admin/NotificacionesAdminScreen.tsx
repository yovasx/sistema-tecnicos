import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { backofficeRepository } from '../../infrastructure/di';
import { useResponsive } from '../../theme/responsive';
import { colores } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Chip } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { Texto } from '../../ui/Texto';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { TablaAdmin } from '../../ui/admin/TablaAdmin';
import { fechaHoraBolivia } from '../../ui/formato';
import { usePaginaAdmin } from './usePaginaAdmin';

const tipos: [string, string][] = [
  ['oferta_orden', 'Ofertas'],
  ['cambio_estado', 'Cambios de estado'],
  ['cotizacion_enviada', 'Cotizaciones enviadas'],
  ['cotizacion_respondida', 'Cotizaciones respondidas'],
  ['mensaje_chat', 'Chat'],
  ['disputa', 'Disputas'],
  ['tarifa_urgencia', 'Urgencia'],
  ['sistema', 'Sistema'],
];

export function NotificacionesAdminScreen() {
  const { esDesktop } = useResponsive();
  const [tipo, setTipo] = useState('');
  const consulta = usePaginaAdmin(p => backofficeRepository.notificaciones(tipo, p), [tipo]);
  if (!esDesktop) return <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;

  return <View style={s.raiz}>
    <Encabezado titulo="Notificaciones" subtitulo="Avisos generados dentro del sistema para cada cuenta."
      derecha={<BotonPrimario titulo="Actualizar notificaciones" tamano="escritorio" variante="secundario"
        deshabilitado={consulta.cargando} onPress={consulta.actualizar} />} />
    <FiltroAdmin etiqueta="Tipo de aviso" valor={tipo || 'todos'}
      opciones={[['todos', 'Todos'], ...tipos]}
      onChange={v => { consulta.reiniciar(); setTipo(v === 'todos' ? '' : v); }} />
    {consulta.error ? <Aviso tono="peligro">{consulta.error}</Aviso> : null}
    {consulta.cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {consulta.datos ? <TablaAdmin filas={consulta.datos.elementos} clave={n => String(n.id)}
      pagina={consulta.datos.pagina} tamano={consulta.datos.tamano} total={consulta.datos.total}
      ocupado={consulta.cargando} onPagina={consulta.irA} anchoMinimo={880}
      columnas={[
        { clave: 'fecha', titulo: 'ENVIADA (BOLIVIA)', ancho: 180, render: n => <View style={{ gap: 6 }}>
          <Texto variante="caption">{fechaHoraBolivia(n.enviadoEn)}</Texto>
          <Chip texto={tipos.find(t => t[0] === n.tipo)?.[1] ?? n.tipo} tono="marca" /></View> },
        { clave: 'destino', titulo: 'DESTINATARIO', ancho: 220, render: n => <View style={{ gap: 4 }}>
          <Texto variante="caption">{n.usuario ?? 'Cuenta eliminada'}</Texto>
          {n.orden ? <Texto variante="caption">Orden #{n.orden}</Texto> : null}</View> },
        { clave: 'mensaje', titulo: 'MENSAJE', render: n => <Texto numberOfLines={3}>{n.mensaje}</Texto> },
        { clave: 'lectura', titulo: 'LECTURA', ancho: 130, render: n => <Chip
          texto={n.leido ? 'Leída' : 'Sin leer'} tono={n.leido ? 'exito' : 'neutro'} /> },
      ]} /> : null}
    <Texto variante="caption">Registro de avisos internos. El envío push a dispositivos no está integrado;
      esta vista no indica entregas fuera de la aplicación.</Texto>
  </View>;
}

const s = StyleSheet.create({ raiz: { gap: 24 } });

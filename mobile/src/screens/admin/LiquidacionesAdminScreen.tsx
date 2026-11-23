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
import { bolivianos, fechaHoraBolivia } from '../../ui/formato';
import { usePaginaAdmin } from './usePaginaAdmin';

const estados: [string, string][] = [
  ['pendiente_pago_tecnico', 'Pendiente de pago'],
  ['pagada_tecnico', 'Pagada al técnico'],
  ['por_cobrar_tecnico', 'Por cobrar al técnico'],
  ['cobrada_tecnico', 'Cobrada al técnico'],
];

export function LiquidacionesAdminScreen() {
  const { esDesktop } = useResponsive();
  const [estado, setEstado] = useState('');
  const consulta = usePaginaAdmin(p => backofficeRepository.liquidaciones(estado, p), [estado]);
  if (!esDesktop) return <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;

  return <View style={s.raiz}>
    <Encabezado titulo="Liquidaciones" subtitulo="Registros generados a partir de pagos confirmados."
      derecha={<BotonPrimario titulo="Actualizar liquidaciones" tamano="escritorio" variante="secundario"
        deshabilitado={consulta.cargando} onPress={consulta.actualizar} />} />
    <FiltroAdmin etiqueta="Estado" valor={estado || 'todos'}
      opciones={[['todos', 'Todas'], ...estados]}
      onChange={v => { consulta.reiniciar(); setEstado(v === 'todos' ? '' : v); }} />
    {consulta.error ? <Aviso tono="peligro">{consulta.error}</Aviso> : null}
    {consulta.cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {consulta.datos ? <TablaAdmin filas={consulta.datos.elementos} clave={l => String(l.id)}
      pagina={consulta.datos.pagina} tamano={consulta.datos.tamano} total={consulta.datos.total}
      ocupado={consulta.cargando} onPagina={consulta.irA} anchoMinimo={940}
      columnas={[
        { clave: 'orden', titulo: 'LIQUIDACIÓN / ORDEN', ancho: 190, render: l => <View style={{ gap: 4 }}>
          <Texto variante="cuerpoFuerte">#{l.id}</Texto>
          <Texto variante="caption">Orden #{l.orden}</Texto>
          <Texto variante="caption">{fechaHoraBolivia(l.creadaEn)}</Texto></View> },
        { clave: 'tecnico', titulo: 'TÉCNICO', render: l => <Texto variante="caption">
          {l.tecnico ?? 'Cuenta eliminada'}</Texto> },
        { clave: 'importes', titulo: 'IMPORTES (BOB)', ancho: 220, render: l => <View style={{ gap: 4 }}>
          <Texto variante="caption">Bruto {bolivianos(l.bruto)}</Texto>
          <Texto variante="caption">Comisión {bolivianos(l.comision)} ({l.comisionPct}%)</Texto>
          <Texto variante="caption">Neto {bolivianos(l.neto)}</Texto></View> },
        { clave: 'estado', titulo: 'ESTADO', ancho: 200, render: l => <View style={{ gap: 6 }}>
          <Chip texto={estados.find(e => e[0] === l.estado)?.[1] ?? l.estado} tono="marca" />
          {l.liquidadaEn ? <Texto variante="caption">{fechaHoraBolivia(l.liquidadaEn)}</Texto> : null}</View> },
      ]} /> : null}
    <Texto variante="caption">Consulta de solo lectura. Sin pagos confirmados no existen liquidaciones;
      esta pantalla no ejecuta desembolsos ni retiros.</Texto>
  </View>;
}

const s = StyleSheet.create({ raiz: { gap: 24 } });

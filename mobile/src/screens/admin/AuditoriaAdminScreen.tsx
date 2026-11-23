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

const origenes: [string, string][] = [
  ['perfil', 'Perfil'],
  ['usuarios', 'Usuarios'],
  ['catalogo', 'Catálogo'],
  ['cobertura', 'Cobertura'],
  ['orden', 'Órdenes'],
  ['disponibilidad', 'Disponibilidad'],
  ['google', 'Google'],
];

export function AuditoriaAdminScreen() {
  const { esDesktop } = useResponsive();
  const [origen, setOrigen] = useState('');
  const consulta = usePaginaAdmin(p => backofficeRepository.auditoria(origen, p), [origen]);
  if (!esDesktop) return <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;

  return <View style={s.raiz}>
    <Encabezado titulo="Auditoría" subtitulo="Bitácoras reales de perfiles, usuarios, catálogo, cobertura y órdenes."
      derecha={<BotonPrimario titulo="Actualizar auditoría" tamano="escritorio" variante="secundario"
        deshabilitado={consulta.cargando} onPress={consulta.actualizar} />} />
    <FiltroAdmin etiqueta="Origen del registro" valor={origen || 'todos'}
      opciones={[['todos', 'Todos'], ...origenes]}
      onChange={v => { consulta.reiniciar(); setOrigen(v === 'todos' ? '' : v); }} />
    {consulta.error ? <Aviso tono="peligro">{consulta.error}</Aviso> : null}
    {consulta.cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {consulta.datos ? <TablaAdmin filas={consulta.datos.elementos} clave={a => `${a.origen}-${a.id}`}
      pagina={consulta.datos.pagina} tamano={consulta.datos.tamano} total={consulta.datos.total}
      ocupado={consulta.cargando} onPagina={consulta.irA} anchoMinimo={980}
      columnas={[
        { clave: 'fecha', titulo: 'FECHA (BOLIVIA)', ancho: 175, render: a => <View style={{ gap: 6 }}>
          <Texto variante="caption">{fechaHoraBolivia(a.creadoEn)}</Texto>
          <Chip texto={origenes.find(o => o[0] === a.origen)?.[1] ?? a.origen} tono="marca" /></View> },
        { clave: 'accion', titulo: 'ACCIÓN / SUJETO', render: a => <View style={{ gap: 4 }}>
          <Texto variante="cuerpoFuerte">{a.accion}</Texto>
          <Texto variante="caption">{a.sujeto ?? `Registro ${a.sujetoId ?? a.id}`}</Texto>
          {a.motivo ? <Texto variante="caption" numberOfLines={3}>Motivo: {a.motivo}</Texto> : null}</View> },
        { clave: 'actor', titulo: 'ACTOR', ancho: 190, render: a => <Texto variante="caption">
          {a.actor ?? 'No registrado en esta bitácora'}</Texto> },
        { clave: 'detalle', titulo: 'DETALLE', render: a => <Texto variante="caption" numberOfLines={4}>
          {Object.keys(a.detalle).length ? JSON.stringify(a.detalle) : 'Sin datos adicionales'}</Texto> },
      ]} /> : null}
    <Texto variante="caption">Vista de solo lectura. Cuando una bitácora no guarda quién actuó, se indica
      explícitamente en lugar de atribuir la acción al sistema.</Texto>
  </View>;
}

const s = StyleSheet.create({ raiz: { gap: 24 } });

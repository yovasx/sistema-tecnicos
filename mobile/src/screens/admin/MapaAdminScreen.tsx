import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PuntoActivo } from '../../domain/models/Backoffice';
import { backofficeRepository } from '../../infrastructure/di';
import { useResponsive } from '../../theme/responsive';
import { colores } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Chip } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Mapa } from '../../ui/mapa/Mapa';
import { fechaHoraBolivia } from '../../ui/formato';
import { useConsulta } from '../useConsulta';

const centroBolivia = { latitud: -16.5, longitud: -68.15 };

export function MapaAdminScreen() {
  const { esDesktop } = useResponsive();
  if (!esDesktop) return <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;
  return <MapaOperativo />;
}

function MapaOperativo() {
  const consulta = useConsulta(() => backofficeRepository.mapa());
  const [orden, setOrden] = useState<number | null>(null);
  const puntos = consulta.datos ?? [];
  const seleccionado = puntos.find(p => p.orden === orden) ?? puntos[0] ?? null;

  return <View style={s.raiz}>
    <Encabezado titulo="Mapa en vivo" subtitulo="Órdenes en curso con la última posición reciente del técnico."
      derecha={<BotonPrimario titulo="Actualizar mapa" tamano="escritorio" variante="secundario"
        deshabilitado={consulta.cargando} onPress={consulta.actualizar} />} />
    {consulta.error ? <Aviso tono="peligro">{consulta.error}</Aviso> : null}
    {consulta.cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {!consulta.cargando && !puntos.length ? <Tarjeta style={{ gap: 8 }}>
      <Texto variante="subtitulo">No hay servicios en curso</Texto>
      <Texto color={colores.secundario}>El mapa muestra únicamente órdenes en camino, en diagnóstico o en
        reparación. Las solicitudes sin técnico no publican su ubicación aquí.</Texto>
    </Tarjeta> : null}
    {seleccionado ? <Mapa alto={440}
      destino={{ latitud: seleccionado.latitudCliente, longitud: seleccionado.longitudCliente }}
      etiquetaPunto={`Orden #${seleccionado.orden}`}
      tecnico={seleccionado.latitudTecnico !== null && seleccionado.longitudTecnico !== null
        ? { latitud: seleccionado.latitudTecnico, longitud: seleccionado.longitudTecnico } : null}
      marcadores={puntos.map(p => ({
        latitud: p.latitudCliente,
        longitud: p.longitudCliente,
        etiqueta: `Orden #${p.orden} · ${p.categoria}`,
      }))} /> : null}
    {seleccionado ? <Tarjeta relleno={16} style={{ gap: 8 }}>
      <Texto variante="subtitulo">Orden #{seleccionado.orden} · {seleccionado.categoria}</Texto>
      <Texto variante="caption">Técnico: {seleccionado.tecnico ?? 'Sin asignar'}</Texto>
      <Texto variante="caption">{seleccionado.posicionEn && seleccionado.latitudTecnico !== null
        ? `Posición recibida ${fechaHoraBolivia(seleccionado.posicionEn)}`
        : 'Sin posición reciente del técnico (últimos 30 segundos).'}</Texto>
    </Tarjeta> : null}
    {puntos.map(p => <FilaOrden key={p.orden} punto={p} activa={seleccionado?.orden === p.orden}
      onPress={() => setOrden(p.orden)} />)}
    <Texto variante="caption">El mapa se carga al entrar a esta sección y se actualiza solo cuando lo pides.
      No se muestran direcciones ni datos de contacto.</Texto>
  </View>;
}

function FilaOrden({ punto, activa, onPress }: { punto: PuntoActivo; activa: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Centrar orden ${punto.orden}`} onPress={onPress}>
    <Tarjeta relleno={16} style={[s.fila, activa && s.activa]}>
      <Ionicons name={punto.latitudTecnico !== null ? 'navigate' : 'location-outline'} size={20}
        color={punto.latitudTecnico !== null ? colores.exito : colores.marca} />
      <View style={{ flex: 1, gap: 4 }}>
        <Texto variante="cuerpoFuerte">Orden #{punto.orden} · {punto.categoria}</Texto>
        <Texto variante="caption">{punto.tecnico ?? 'Sin técnico'} · {fechaHoraBolivia(punto.creadoEn)}</Texto>
      </View>
      {punto.urgencia ? <Chip texto="Urgente" tono="advertencia" /> : null}
      <Chip texto={punto.estado.replaceAll('_', ' ')} tono="marca" />
    </Tarjeta>
  </Pressable>;
}

const s = StyleSheet.create({
  raiz: { gap: 20 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  activa: { borderColor: colores.marca },
});

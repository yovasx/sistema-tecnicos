import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardAdmin } from '../../domain/models/Admin';
import { adminRepository } from '../../infrastructure/di';
import { useNavegacionAdmin } from '../../navigation/NavegacionAdmin';
import { useResponsive } from '../../theme/responsive';
import { colores } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Chip } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { fechaHoraBolivia } from '../../ui/formato';

/** Inicio operativo: no descarga ni duplica la tabla de Usuarios. */
export function DashboardAdminScreen() {
  const navegar = useNavegacionAdmin();
  const { ancho } = useResponsive();
  const [dias, setDias] = useState<7 | 30>(7);
  const [datos, setDatos] = useState<DashboardAdmin | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(''); setDatos(null);
    adminRepository.dashboard(dias).then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No pudimos cargar el panel.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [dias, recarga]);
  const m = datos?.metricas;
  const totalPeriodo = datos?.solicitudesPorDia.reduce((total, d) => total + d.solicitudes, 0) ?? 0;
  const maximo = Math.max(1, ...(datos?.solicitudesPorDia.map(d => d.solicitudes) ?? []));
  return <View style={s.raiz}>
    <Encabezado titulo="Centro de operaciones"
      subtitulo="Lo que necesita atención y el movimiento de Fixly, en un solo lugar."
      derecha={<BotonPrimario titulo="Actualizar panel" variante="secundario" tamano="escritorio"
        cargando={cargando} onPress={() => setRecarga(n => n + 1)} />} />
    <View style={s.entre}>
      <Chip texto="Administración · La Paz, Bolivia" tono="marca" />
      <Texto variante="caption">{datos ? `Última actualización: ${fechaHoraBolivia(datos.generadoEn)}` :
        'Las cifras se consultan al abrir o actualizar el panel.'}</Texto>
    </View>
    {error ? <><Aviso tono="peligro" titulo="No pudimos actualizar el panel">
      {error} No se muestran cifras anteriores como si fueran actuales.
    </Aviso><BotonPrimario titulo="Reintentar panel" onPress={() => setRecarga(n => n + 1)} /></> : null}
    {cargando ? <View style={s.fila}><ActivityIndicator color={colores.marca} /><Texto>Cargando resumen operativo…</Texto></View> : null}
    {datos && m ? <>
      <View style={s.indicadores}>
        <Indicador titulo="Órdenes abiertas" valor={m.ordenesAbiertas} icono="receipt-outline"
          detalle="Sin finalizar ni cancelar" onPress={() => navegar({ seccion: 'ordenes' })} />
        <Indicador titulo="Sin asignar" valor={m.solicitudesSinAsignar} icono="hourglass-outline"
          detalle="Solicitadas y sin técnico" onPress={() => navegar({ seccion: 'ordenes' })} />
        <Indicador titulo="Expedientes en revisión" valor={m.expedientesEnRevision} icono="document-text-outline"
          detalle="Enviados por cuentas activas" onPress={() => navegar({ seccion: 'validacion' })} />
        <Indicador titulo="Técnicos aprobados" valor={m.tecnicosActivosAprobados} icono="construct-outline"
          detalle="Con cuenta activa; no implica disponibilidad" onPress={() => navegar({ seccion: 'tecnicos' })} />
      </View>

      <Tarjeta style={{ gap: 24 }}>
        <View style={s.entre}>
          <View style={{ gap: 6 }}>
            <Texto variante="subtitulo">Solicitudes recibidas</Texto>
            <Texto variante="caption">Del {dia(datos.desde)} al {dia(datos.hasta)} · días de Bolivia</Texto>
          </View>
          <FiltroAdmin etiqueta="Período" valor={String(dias)}
            opciones={[['7', '7 días'], ['30', '30 días']]} onChange={v => setDias(v === '30' ? 30 : 7)} />
        </View>
        <View style={s.fila}>
          <Texto variante="display">{totalPeriodo}</Texto>
          <Texto color={colores.secundario}>solicitudes en el período</Texto>
        </View>
        <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
          <View style={[s.grafico, { minWidth: dias * 30 }]}>
            {datos.solicitudesPorDia.map(d => <View key={d.fecha} style={s.dia}
              accessible accessibilityLabel={`${dia(d.fecha)}: ${d.solicitudes} solicitudes`}>
              <Texto variante="caption">{d.solicitudes}</Texto>
              <View style={s.pista}>
                {d.solicitudes > 0 ? <View style={[s.barra, { height: d.solicitudes / maximo * 120 }]} /> : null}
              </View>
              <Texto variante="caption">{dia(d.fecha)}</Texto>
            </View>)}
          </View>
        </ScrollView>
        {totalPeriodo === 0 ? <Aviso>No hay solicitudes registradas en este período.</Aviso> : null}
        <Texto variante="caption">Cuenta las órdenes creadas, aunque después hayan finalizado o sido canceladas.
          Los indicadores superiores muestran el estado actual, no el período del gráfico.</Texto>
      </Tarjeta>

      <View style={[s.pendientes, { flexDirection: ancho >= 1360 ? 'row' : 'column' }]}>
        <Tarjeta style={s.cola}>
          <View style={s.entre}><Texto variante="subtitulo">Solicitudes por atender</Texto>
            <Chip texto={String(m.solicitudesSinAsignar)} tono={m.solicitudesSinAsignar ? 'advertencia' : 'neutro'} /></View>
          <Texto variante="caption">Hasta 5 pendientes. Urgentes primero; luego las más antiguas.</Texto>
          {!datos.solicitudesPendientes.length ? <Vacio icono="checkmark-circle-outline"
            texto="No hay solicitudes pendientes de asignación." /> : datos.solicitudesPendientes.map(o =>
            <View key={o.id} style={s.item}>
              <View style={{ flex: 1, gap: 6 }}>
                <Texto variante="etiqueta">Orden #{o.id} · {o.categoria}</Texto>
                <Texto variante="caption">{fechaHoraBolivia(o.creadoEn)}</Texto>
                {o.urgencia ? <View style={{ alignSelf: 'flex-start' }}><Chip texto="Urgente" tono="advertencia" /></View> : null}
              </View>
              <BotonPrimario titulo="Ver orden" etiquetaAccesible={`Ver orden ${o.id} desde el panel`}
                variante="secundario" tamano="escritorio" onPress={() => navegar({ seccion: 'ordenes', orden: o.id })} />
            </View>)}
          <BotonPrimario titulo="Ver todas las órdenes" variante="secundario" tamano="escritorio"
            onPress={() => navegar({ seccion: 'ordenes' })} />
          <Texto variante="caption">La consulta de órdenes es de solo lectura. La asignación operativa sigue pendiente.</Texto>
        </Tarjeta>
        <Tarjeta style={s.cola}>
          <View style={s.entre}><Texto variante="subtitulo">Revisión documental</Texto>
            <Chip texto={String(m.expedientesEnRevision)} tono={m.expedientesEnRevision ? 'advertencia' : 'neutro'} /></View>
          <Texto variante="caption">Expedientes enviados de cuentas activas, del más antiguo al más reciente.</Texto>
          {!datos.expedientesPendientes.length ? <Vacio icono="documents-outline"
            texto="No hay expedientes enviados pendientes de revisión." /> : datos.expedientesPendientes.map(t =>
            <View key={t.id} style={s.item}>
              <View style={{ flex: 1, gap: 6 }}><Texto variante="etiqueta">{t.nombre}</Texto>
                <Texto variante="caption">{t.enviadoEn ? fechaHoraBolivia(t.enviadoEn) : 'Sin fecha de envío registrada'}</Texto></View>
              <BotonPrimario titulo="Ver técnico" variante="secundario" tamano="escritorio"
                onPress={() => navegar({ seccion: 'tecnicos', usuario: t.id })} />
            </View>)}
          <BotonPrimario titulo="Abrir cola de revisión" variante="secundario" tamano="escritorio"
            onPress={() => navegar({ seccion: 'validacion' })} />
        </Tarjeta>
      </View>
      <Tarjeta style={s.entre}>
        <View style={{ gap: 6 }}><Texto variante="subtitulo">Gestión de la empresa</Texto>
          <Texto variante="caption">{m.usuariosActivos} cuentas activas · {m.categoriasActivas} categorías activas</Texto></View>
        <View style={s.fila}>
          <BotonPrimario titulo="Gestionar usuarios" variante="secundario" tamano="escritorio"
            onPress={() => navegar({ seccion: 'usuarios' })} />
          <BotonPrimario titulo="Gestionar catálogo" variante="secundario" tamano="escritorio"
            onPress={() => navegar({ seccion: 'catalogo' })} />
        </View>
      </Tarjeta>
    </> : null}
  </View>;
}
function dia(fecha: string) { return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`; }
function Indicador({ titulo, valor, detalle, icono, onPress }: {
  titulo: string; valor: number; detalle: string; icono: keyof typeof Ionicons.glyphMap; onPress: () => void;
}) {
  const { ancho } = useResponsive();
  return <Pressable style={[s.indicador, { flexBasis: ancho >= 1360 ? '22%' : '46%' }]}
    accessibilityRole="button" onPress={onPress}
    accessibilityLabel={`${titulo}: ${valor}. ${detalle}. Abrir módulo`}>
    <View style={s.entre}><Texto variante="etiqueta">{titulo}</Texto>
      <Ionicons name={icono} size={22} color={colores.marca} /></View>
    <Texto variante="display">{valor}</Texto>
    <Texto variante="caption">{detalle}</Texto>
  </Pressable>;
}
function Vacio({ icono, texto }: { icono: keyof typeof Ionicons.glyphMap; texto: string }) {
  return <View style={s.vacio}><Ionicons name={icono} size={28} color={colores.terciario} />
    <Texto variante="caption" centrado>{texto}</Texto></View>;
}
const s = StyleSheet.create({
  raiz: { gap: 24, maxWidth: 1600 },
  entre: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  indicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  indicador: { flexGrow: 1, minWidth: 0, padding: 20, gap: 12,
    borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.superficie, borderRadius: 16 },
  grafico: { flexDirection: 'row', flex: 1, gap: 8 },
  dia: { flex: 1, minWidth: 22, alignItems: 'center', gap: 8 },
  pista: { height: 120, width: '100%', maxWidth: 44, justifyContent: 'flex-end',
    borderBottomWidth: 1, borderColor: colores.linea },
  barra: { backgroundColor: colores.marca, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  pendientes: { gap: 24, alignItems: 'stretch' },
  cola: { flex: 1, gap: 16, minWidth: 0 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: colores.linea },
  vacio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 12 },
});

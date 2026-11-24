import { useCallback, useEffect, useRef, useState } from 'react';
import { CalificarServicio } from './CalificarServicio';
import { SeguimientoServicio } from './SeguimientoServicio';
import { OperacionDelServicio } from '../servicios/OperacionDelServicio';
import { CancelarSolicitud } from './CancelarSolicitud';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import axios from 'axios';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DetalleServicio, FilaServicio } from '../../domain/models/SolicitudServicio';
import { solicitudesRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';
import { useSolicitudServicio } from '../../session/SolicitudServicioProvider';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Chip } from '../../ui/Chip';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { fechaHoraBolivia } from '../../ui/formato';
import { Mapa } from '../../ui/mapa/Mapa';
import { puntoValido } from '../../ui/mapa/contrato';
import { useResponsive } from '../../theme/responsive';
import { colores, espacio } from '../../theme/tokens';
import { iconoCategoria } from '../publico/categorias';
import { estadoServicio } from './estadosServicio';

interface Lista {
  filas: FilaServicio[];
  total: number;
  pagina: number;
  cargando: boolean;
  mas: boolean;
  refrescando: boolean;
  error: string;
}

const listaInicial: Lista = {
  filas: [],
  total: 0,
  pagina: 0,
  cargando: true,
  mas: false,
  refrescando: false,
  error: '',
};

export interface MisServiciosProps {
  /** En empresa la sección se llama Órdenes; el contenido es el mismo. */
  titulo?: string;
}

/**
 * Servicios del cliente autenticado.
 *
 * <p>El backend filtra siempre por el cliente del JWT: esta pantalla no manda
 * un id de cliente ni puede ver órdenes de otra cuenta.</p>
 */
export function MisServicios({ titulo = 'Mis servicios' }: MisServiciosProps) {
  const { esDesktop } = useResponsive();
  const { abrir, recarga } = useSolicitudServicio();
  const [lista, setLista] = useState<Lista>(listaInicial);
  const peticion = useRef(0);

  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetalleServicio | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [intentoDetalle, setIntentoDetalle] = useState(0);
  const [descargando, setDescargando] = useState(false);
  const [errorEvidencia, setErrorEvidencia] = useState('');
  const [interaccionDetalle, setInteraccionDetalle] = useState(false);

  const cargar = useCallback(
    async (pagina: number, modo: 'inicial' | 'mas' | 'refresco') => {
      const turno = ++peticion.current;
      setLista((previa) => ({
        ...previa,
        cargando: modo === 'inicial',
        mas: modo === 'mas',
        refrescando: modo === 'refresco',
        error: '',
      }));
      try {
        const r = await solicitudesRepository.propias(pagina);
        if (turno !== peticion.current) return;
        setLista((previa) => ({
          filas: pagina === 0 ? r.elementos : [...previa.filas, ...r.elementos],
          total: r.total,
          pagina,
          cargando: false,
          mas: false,
          refrescando: false,
          error: '',
        }));
      } catch (e) {
        if (turno !== peticion.current) return;
        const error = e as ErrorApi;
        setLista((previa) => ({
          ...previa,
          cargando: false,
          mas: false,
          refrescando: false,
          error: error.sinConexion
            ? 'No pudimos cargar tus servicios. Revisa tu conexión.'
            : error.message || 'No pudimos cargar tus servicios.',
        }));
      }
    },
    [],
  );

  useEffect(() => {
    void cargar(0, 'inicial');
  }, [cargar, recarga]);

  useEffect(() => {
    if (detalleId === null) {
      setDetalle(null);
      setErrorDetalle('');
      return;
    }
    let vigente = true;
    setCargandoDetalle(true);
    setErrorDetalle('');
    setErrorEvidencia('');
    solicitudesRepository
      .detalle(detalleId)
      .then((d) => {
        if (vigente) setDetalle(d);
      })
      .catch((e) => {
        if (!vigente) return;
        const error = e as ErrorApi;
        setErrorDetalle(
          error.sinConexion
            ? 'No pudimos cargar el detalle. Revisa tu conexión.'
            : error.message || 'No pudimos cargar el detalle.',
        );
      })
      .finally(() => {
        if (vigente) setCargandoDetalle(false);
      });
    return () => {
      vigente = false;
    };
  }, [detalleId, recarga, intentoDetalle]);

  async function descargarEvidencia(d: DetalleServicio) {
    if (descargando) return;
    setDescargando(true);
    setErrorEvidencia('');
    try {
      await solicitudesRepository.descargarEvidencia(d.id, d.evidenciaExtension);
    } catch (e) {
      setErrorEvidencia(
        e instanceof Error && !axios.isAxiosError(e)
          ? e.message
          : 'No pudimos descargar la evidencia.',
      );
    } finally {
      setDescargando(false);
    }
  }

  if (detalleId !== null) {
    return (
      <ContenedorApp>
        <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
          <ScrollView
            contentContainerStyle={[estilos.contenido, esDesktop && estilos.contenidoDesktop]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a la lista de servicios"
              accessibilityState={{ disabled: interaccionDetalle }}
              disabled={interaccionDetalle}
              onPress={() => { setDetalleId(null); void cargar(0, 'refresco'); }}
              style={estilos.volver}
            >
              <Ionicons name="arrow-back" size={18} color={colores.marca} />
              <Texto variante="etiqueta" color={colores.marca}>
                Volver a {titulo.toLowerCase()}
              </Texto>
            </Pressable>

            {cargandoDetalle ? <ActivityIndicator color={colores.marca} /> : null}
            {errorDetalle ? (
              <>
                <Aviso tono="advertencia">{errorDetalle}</Aviso>
                <BotonPrimario
                  titulo="Reintentar"
                  variante="secundario"
                  onPress={() => setIntentoDetalle((n) => n + 1)}
                />
              </>
            ) : null}
            {detalle && !cargandoDetalle && !errorDetalle ? (
              <DetalleServicioVista
                key={`detalle-${detalle.id}`}
                detalle={detalle}
                descargando={descargando}
                errorEvidencia={errorEvidencia}
                onDescargar={() => void descargarEvidencia(detalle)}
                onActualizar={() => setIntentoDetalle((n) => n + 1)}
                onInteraccion={setInteraccionDetalle}
              />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </ContenedorApp>
    );
  }

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[estilos.contenido, esDesktop && estilos.contenidoDesktop]}
          refreshControl={
            <RefreshControl
              refreshing={lista.refrescando}
              onRefresh={() => void cargar(0, 'refresco')}
              tintColor={colores.marca}
              colors={[colores.marca]}
            />
          }
        >
          <Encabezado
            titulo={titulo}
            subtitulo="Solicitudes, estado y evidencia de tus servicios."
            derecha={
              esDesktop ? (
                <View style={estilos.ctaDesktop}>
                  <BotonPrimario
                    titulo="Nueva solicitud"
                    tamano="escritorio"
                    onPress={() => abrir()}
                  />
                </View>
              ) : null
            }
          />

          {!esDesktop ? (
            <BotonPrimario titulo="Solicitar un servicio" onPress={() => abrir()} />
          ) : null}

          {lista.cargando ? <ActivityIndicator color={colores.marca} /> : null}
          {lista.error ? (
            <>
              <Aviso tono="advertencia">{lista.error}</Aviso>
              <BotonPrimario
                titulo="Reintentar"
                variante="secundario"
                onPress={() => void cargar(0, 'inicial')}
              />
            </>
          ) : null}

          {!lista.cargando && !lista.error && lista.filas.length === 0 ? (
            <Tarjeta style={estilos.vacio}>
              <View style={estilos.vacioIcono}>
                <Ionicons name="construct-outline" size={28} color={colores.marca} />
              </View>
              <Texto variante="subtitulo" centrado>
                Todavía no pediste ningún servicio
              </Texto>
              <Texto variante="caption" color={colores.secundario} centrado>
                Cuéntanos qué necesitas arreglar y registraremos tu solicitud.
              </Texto>
              <View style={estilos.vacioCta}>
                <BotonPrimario titulo="Solicitar un servicio" onPress={() => abrir()} />
              </View>
            </Tarjeta>
          ) : null}

          {lista.filas.map((fila) => {
            const estado = estadoServicio(fila.estado);
            return (
              <Pressable
                key={fila.id}
                accessibilityRole="button"
                accessibilityLabel={`Orden ${fila.id}, ${fila.categoria}, ${estado.texto}`}
                onPress={() => setDetalleId(fila.id)}
                style={({ pressed }) => (pressed ? estilos.presionado : undefined)}
              >
                <Tarjeta relleno={espacio.base} style={estilos.filaTarjeta}>
                  <View style={estilos.filaIcono}>
                    <Ionicons
                      name={iconoCategoria(fila.categoria)}
                      size={22}
                      color={colores.marca}
                    />
                  </View>
                  <View style={estilos.filaTextos}>
                    <Texto variante="cuerpoFuerte">{fila.categoria}</Texto>
                    <Texto variante="caption" color={colores.secundario}>
                      Orden #{fila.id} · {fechaHoraBolivia(fila.creadoEn)}
                    </Texto>
                    <View style={estilos.chips}>
                      <Chip texto={estado.texto} tono={estado.tono} />
                      {fila.urgencia ? <Chip texto="Urgente" tono="advertencia" /> : null}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colores.deshabilitado} />
                </Tarjeta>
              </Pressable>
            );
          })}

          {lista.filas.length > 0 && lista.filas.length < lista.total ? (
            <BotonPrimario
              titulo={lista.mas ? 'Cargando…' : 'Cargar más'}
              variante="secundario"
              cargando={lista.mas}
              onPress={() => void cargar(lista.pagina + 1, 'mas')}
            />
          ) : null}

          {lista.filas.length > 0 ? (
            <Texto variante="caption" color={colores.terciario} centrado>
              {lista.filas.length} de {lista.total} solicitudes
            </Texto>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ContenedorApp>
  );
}

function DetalleServicioVista({
  detalle,
  descargando,
  errorEvidencia,
  onDescargar,
  onActualizar,
  onInteraccion,
}: {
  detalle: DetalleServicio;
  descargando: boolean;
  errorEvidencia: string;
  onDescargar: () => void;
  onActualizar: () => void;
  onInteraccion: (activa: boolean) => void;
}) {
  const estado = estadoServicio(detalle.estado);
  const [editandoOperacion, setEditandoOperacion] = useState(false);
  const [editandoCalificacion, setEditandoCalificacion] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [errorMapa, setErrorMapa] = useState('');
  const interaccion = editandoOperacion || editandoCalificacion || cancelando;
  useCambiosSinGuardar(interaccion);
  useEffect(() => { onInteraccion(interaccion); return () => onInteraccion(false); }, [interaccion, onInteraccion]);
  function alternarMapa() {
    setErrorMapa('');
    if (!mapaAbierto && !puntoValido({ latitud: detalle.latitud, longitud: detalle.longitud })) {
      setErrorMapa('Las coordenadas registradas no son válidas.');
      return;
    }
    setMapaAbierto(v => !v);
  }
  return (
    <>
      <Encabezado
        titulo={`Orden #${detalle.id}`}
        subtitulo={`${detalle.categoria} · ${fechaHoraBolivia(detalle.creadoEn)}`}
        derecha={<Chip texto={estado.texto} tono={estado.tono} />}
      />
      <SeguimientoServicio key={`seguimiento-${detalle.id}`} orden={detalle.id}
        latitud={detalle.latitud} longitud={detalle.longitud} estadoOrden={detalle.estado} />
      {detalle.estado === 'finalizado' && detalle.tecnico ? <CalificarServicio key={`calificacion-${detalle.id}`}
        orden={detalle.id} actual={detalle.miCalificacion} onGuardada={onActualizar}
        onEdicion={setEditandoCalificacion} bloqueado={editandoOperacion} /> : null}
      {detalle.estado === 'solicitado' ? <CancelarSolicitud orden={detalle.id} onCambio={onActualizar} onEdicion={setCancelando} /> : null}
      {detalle.asignadoEn || detalle.tecnico || ['en_camino', 'en_diagnostico', 'en_reparacion', 'finalizado'].includes(detalle.estado)
        ? <OperacionDelServicio orden={detalle.id} tecnico={false} estado={detalle.estado} onCambio={onActualizar}
          onEdicion={setEditandoOperacion} bloqueado={editandoCalificacion} /> : null}

      {detalle.estado === 'solicitado' ? (
        <Aviso tono="info" titulo="Solicitud registrada">
          Todavía no hay un técnico asignado ni un precio final. Cuando existan, vas a ver
          la novedad en este detalle.
        </Aviso>
      ) : null}

      {detalle.estado === 'cancelado' ? (
        <Aviso tono="peligro" titulo="Solicitud cancelada">
          {detalle.motivoCancelacion ?? 'La orden fue cancelada.'}
          {detalle.canceladoEn ? ` · ${fechaHoraBolivia(detalle.canceladoEn)}` : ''}
        </Aviso>
      ) : null}

      <Tarjeta>
        <View style={estilos.bloque}>
          <Texto variante="etiqueta" color={colores.secundario}>
            Descripción
          </Texto>
          <Texto variante="cuerpo">{detalle.descripcion}</Texto>
        </View>
        <View style={estilos.separador} />
        <Dato etiqueta="Urgencia" valor={detalle.urgencia ? 'Sí' : 'No'} />
        <Dato etiqueta="Dirección o referencia" valor={detalle.referencia} />
        <Dato
          etiqueta="Coordenadas"
          valor={`${detalle.latitud.toFixed(6)}, ${detalle.longitud.toFixed(6)}`}
        />
        <Pressable accessibilityRole="button" onPress={alternarMapa} style={estilos.enlace}>
          <Ionicons name="map-outline" size={16} color={colores.marca} />
          <Texto variante="etiqueta" color={colores.marca}>
            {mapaAbierto ? 'Ocultar mapa' : 'Ver ubicación con Leaflet'}
          </Texto>
        </Pressable>
        {errorMapa ? <Aviso tono="advertencia">{errorMapa}</Aviso> : null}
        {mapaAbierto ? <Mapa destino={{ latitud: detalle.latitud, longitud: detalle.longitud }} alto={300} /> : null}
      </Tarjeta>

      <Tarjeta>
        <Texto variante="etiqueta" color={colores.secundario}>
          Técnico
        </Texto>
        <Texto variante="cuerpo">
          {detalle.tecnico ?? 'Todavía no hay un técnico asignado.'}
        </Texto>
        <View style={estilos.separador} />
        <Dato etiqueta="Solicitada" valor={fechaHoraBolivia(detalle.creadoEn)} />
        {detalle.asignadoEn ? (
          <Dato etiqueta="Asignada" valor={fechaHoraBolivia(detalle.asignadoEn)} />
        ) : null}
        {detalle.llegadaEstimadaEn ? (
          <Dato
            etiqueta="Llegada estimada"
            valor={fechaHoraBolivia(detalle.llegadaEstimadaEn)}
          />
        ) : null}
        {detalle.llegadaEn ? (
          <Dato etiqueta="Llegada" valor={fechaHoraBolivia(detalle.llegadaEn)} />
        ) : null}
        {detalle.finalizadoEn ? (
          <Dato etiqueta="Finalizada" valor={fechaHoraBolivia(detalle.finalizadoEn)} />
        ) : null}
      </Tarjeta>

      <Tarjeta>
        <Texto variante="etiqueta" color={colores.secundario}>
          Evidencia
        </Texto>
        {detalle.evidenciaDisponible ? (
          <>
            <Texto variante="caption" color={colores.secundario}>
              Archivo privado adjunto a tu solicitud.
            </Texto>
            <BotonPrimario
              titulo="Descargar evidencia"
              variante="secundario"
              cargando={descargando}
              onPress={onDescargar}
            />
          </>
        ) : (
          <Texto variante="caption" color={colores.secundario}>
            No adjuntaste ningún archivo.
          </Texto>
        )}
        {errorEvidencia ? (
          <Texto variante="caption" color={colores.peligro}>
            {errorEvidencia}
          </Texto>
        ) : null}
      </Tarjeta>

      <BotonPrimario
        titulo="Actualizar estado"
        variante="secundario"
        deshabilitado={interaccion}
        onPress={onActualizar}
      />
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato}>
      <Texto variante="caption" color={colores.secundario}>
        {etiqueta}
      </Texto>
      <Texto variante="cuerpo">{valor}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  seguro: { flex: 1 },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.lg,
    paddingBottom: espacio.lg,
    gap: espacio.base,
  },
  contenidoDesktop: {
    paddingHorizontal: 0,
    paddingTop: 0,
    maxWidth: 900,
  },
  ctaDesktop: {
    minWidth: 180,
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  filaTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
  },
  filaIcono: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.marcaSuave,
  },
  filaTextos: {
    flex: 1,
    gap: 2,
  },
  chips: {
    flexDirection: 'row',
    gap: espacio.sm,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  presionado: {
    opacity: 0.75,
  },
  vacio: {
    alignItems: 'center',
    gap: espacio.md,
  },
  vacioIcono: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.marcaSuave,
  },
  vacioCta: {
    alignSelf: 'stretch',
  },
  bloque: {
    gap: 4,
  },
  separador: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colores.linea,
    marginVertical: espacio.md,
  },
  dato: {
    gap: 2,
    marginBottom: espacio.sm,
  },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
});

import { useContext, useEffect, useState } from 'react';
import { AppState, Image, Platform } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { Seguimiento } from '../../domain/models/Hogar';
import { hogarRepository } from '../../infrastructure/di';
import { urlApi } from '../../infrastructure/http/HogarApiRepository';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Mapa } from '../../ui/mapa/Mapa';
import { fechaHoraBolivia } from '../../ui/formato';

export function SeguimientoServicio({ orden, latitud, longitud, estadoOrden }: {
  orden: number; latitud: number; longitud: number; estadoOrden: string;
}) {
  const nav = useContext(NavigationContext);
  const [foco, setFoco] = useState(nav?.isFocused() ?? true);
  const [visible, setVisible] = useState(AppState.currentState === 'active');
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState('');
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [simular, setSimular] = useState(false);
  const [paso, setPaso] = useState(0);
  const [consultando, setConsultando] = useState(false);
  async function actualizar() {
    if (consultando) return;
    setConsultando(true);
    try {
      setDatos(await hogarRepository.seguimiento(orden));
      setEstado('Consulta puntual actualizada. El canal en vivo se reconecta por separado.');
    } catch (e) { setEstado(e instanceof Error ? e.message : 'No pudimos actualizar el seguimiento.'); }
    finally { setConsultando(false); }
  }
  useEffect(() => {
    const a = nav?.addListener('focus', () => setFoco(true));
    const b = nav?.addListener('blur', () => setFoco(false));
    const sub = AppState.addEventListener('change', s => setVisible(s === 'active'));
    const cambiar = () => setVisible(!document.hidden);
    if (Platform.OS === 'web') {
      cambiar(); document.addEventListener('visibilitychange', cambiar);
    }
    return () => {
      a?.(); b?.(); sub.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', cambiar);
    };
  }, [nav]);
  useEffect(() => {
    if (!abierto || !visible || !foco || simular || estadoOrden !== 'en_camino') return;
    return hogarRepository.conectar(orden, setDatos, texto => {
      setEstado(texto);
      if (texto !== 'En vivo') setDatos(d => d ? { ...d, vigente: false, etaMinutos: null } : d);
    });
  }, [abierto, visible, foco, orden, simular, estadoOrden]);
  useEffect(() => {
    if (!__DEV__ || !simular || !visible || !foco) return;
    const t = setInterval(() => setPaso(n => (n + 1) % 41), 1000);
    return () => clearInterval(t);
  }, [simular, visible, foco]);
  // El simulador solo vive en memoria, no reporta posiciones ni cambia órdenes.
  const posicion = __DEV__ && simular ? {
    latitud: latitud + (40 - paso) * 0.0002,
    longitud: longitud + (40 - paso) * 0.00015,
  } : datos?.posicion;
  const enCamino = estadoOrden === 'en_camino' && (!datos || datos.estado === 'en_camino');
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">Seguimiento del técnico</Texto>
    {!enCamino ? <Texto>El seguimiento se habilita cuando un técnico asignado está en camino.</Texto> : null}
    <Texto variante="caption">Al abrir el mapa se consultan Leaflet y el proveedor de mapas. No se activa el GPS del cliente.</Texto>
    {(enCamino || __DEV__) ? <BotonPrimario titulo={abierto ? 'Cerrar seguimiento' : 'Abrir mapa de seguimiento'}
      variante="secundario" onPress={() => { setAbierto(v => !v); setSimular(false); setDatos(null); }} /> : null}
    {abierto ? <>
      {__DEV__ ? <BotonPrimario titulo={simular ? 'Detener simulación' : 'Probar ruta simulada (desarrollo)'}
        variante="secundario" onPress={() => { setSimular(v => !v); setPaso(0); setDatos(null); }} /> : null}
      {simular ? <Aviso tono="advertencia">SIMULACIÓN LOCAL: no hay un técnico real ni una ruta vial.</Aviso>
        : <Texto>{estado || 'Esperando posición del técnico.'}</Texto>}
      {!simular && datos?.fichaTecnico ? <>
        {datos.fichaTecnico.fotoUrl ? <Image source={{ uri: urlApi(datos.fichaTecnico.fotoUrl) }}
          accessibilityLabel="Foto del técnico asignado" style={{ width: 64, height: 64, borderRadius: 32 }} /> : null}
        <Texto variante="cuerpoFuerte">{datos.fichaTecnico.nombre}</Texto>
        <Texto>{datos.fichaTecnico.totalCalificaciones && datos.fichaTecnico.promedio != null
          ? `${datos.fichaTecnico.promedio.toFixed(1)} / 5 · ${datos.fichaTecnico.totalCalificaciones} valoraciones`
          : 'Sin valoraciones registradas'}</Texto>
      </> : null}
      {(!simular && datos?.posicion) ? <Texto variante="caption">
        Última posición: {fechaHoraBolivia(datos.posicion.actualizadoEn)}{!datos.vigente ? ' · Ubicación desactualizada' : ''}
      </Texto> : null}
      {datos?.etaMinutos && datos.vigente && !simular
        ? <Texto>Aproximadamente {datos.etaMinutos} min. Estimación por distancia, sin tráfico ni ruta vial.</Texto> : null}
      {abierto && visible && foco ? <Mapa destino={{ latitud, longitud }} tecnico={enCamino || simular ? posicion : null} /> : null}
      {!posicion ? <Texto>No hay una ubicación disponible. No se muestra un técnico ficticio.</Texto> : null}
      {!simular ? <BotonPrimario titulo="Actualizar posición" variante="secundario" cargando={consultando}
        onPress={() => void actualizar()} /> : null}
    </> : null}
  </Tarjeta>;
}

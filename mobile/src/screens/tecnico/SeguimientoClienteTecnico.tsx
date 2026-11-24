import { useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { hogarRepository } from '../../infrastructure/di';
import { Seguimiento } from '../../domain/models/Hogar';
import { Mapa } from '../../ui/mapa/Mapa';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { fechaHoraBolivia } from '../../ui/formato';

export function SeguimientoClienteTecnico({ orden, latitud, longitud, estadoOrden }: {
  orden: number;
  latitud: number;
  longitud: number;
  estadoOrden: string;
}) {
  const nav = useContext(NavigationContext);
  const [foco, setFoco] = useState(nav?.isFocused() ?? true);
  const [visible, setVisible] = useState(AppState.currentState === 'active');
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState('');
  const [datos, setDatos] = useState<Seguimiento | null>(null);

  useEffect(() => {
    const alEnfocar = nav?.addListener('focus', () => setFoco(true));
    const alOcultar = nav?.addListener('blur', () => setFoco(false));
    const sub = AppState.addEventListener('change', s => setVisible(s === 'active'));
    const cambiar = () => setVisible(!document.hidden);
    if (Platform.OS === 'web') {
      cambiar();
      document.addEventListener('visibilitychange', cambiar);
    }
    return () => {
      alEnfocar?.();
      alOcultar?.();
      sub.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', cambiar);
    };
  }, [nav]);

  useEffect(() => {
    if (!abierto || !visible || !foco || estadoOrden !== 'en_camino') return;
    return hogarRepository.conectar(orden, setDatos, setEstado);
  }, [abierto, visible, foco, orden, estadoOrden]);

  const posicionCliente = datos?.clienteVigente ? datos.posicionCliente : null;
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">Seguimiento del servicio</Texto>
    <Texto variante="caption">{estadoOrden === 'en_camino'
      ? 'El mapa se abre solo cuando lo solicitas. La ubicación del cliente aparece únicamente si decidió compartirla.'
      : 'El mapa muestra el destino registrado; no hay seguimiento en vivo en este estado.'}</Texto>
    <BotonPrimario titulo={abierto ? 'Cerrar mapa' : estadoOrden === 'en_camino'
      ? 'Ver seguimiento en tiempo real' : 'Ver destino en el mapa'}
      variante="secundario" onPress={() => { setAbierto(v => !v); setDatos(null); }} />
    {abierto && estadoOrden === 'en_camino' ? <>
      <Texto>{estado || 'Conectando al seguimiento…'}</Texto>
      {datos?.clienteCompartiendo
        ? <Texto variante="caption">{datos.clienteVigente && datos.posicionCliente
          ? `Ubicación del cliente actualizada: ${fechaHoraBolivia(datos.posicionCliente.actualizadoEn)}`
          : 'El cliente comparte su ubicación, pero todavía no hay una señal reciente.'}</Texto>
        : <Texto variante="caption">El cliente no está compartiendo su ubicación.</Texto>}
      {datos?.posicion && !datos.vigente
        ? <Texto variante="caption">Tu última ubicación enviada está desactualizada.</Texto> : null}
    </> : null}
    {abierto ? <Mapa destino={{ latitud, longitud }}
      tecnico={estadoOrden === 'en_camino' ? datos?.posicion : null}
      cliente={posicionCliente} /> : null}
  </Tarjeta>;
}

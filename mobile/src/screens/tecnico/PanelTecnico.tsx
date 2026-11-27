import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OfertaTecnico, ServicioTecnico } from '../../domain/models/Operacion';
import { operacionRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { Chip } from '../../ui/Chip';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { ServicioTecnicoDetalle } from './ServicioTecnicoDetalle';
import { fechaHoraBolivia } from '../../ui/formato';
import { colores } from '../../theme/tokens';
import { useActualizacionVisible } from '../useActualizacionVisible';

export function distanciaLegible(metros: number | null) {
  if (metros === null || !Number.isFinite(metros)) return 'Distancia por confirmar';
  return metros < 1000 ? `${Math.round(metros)} m de ti` : `${(metros / 1000).toFixed(1)} km de ti`;
}

export function PanelTecnico() {
  const c = useConsulta(() => operacionRepository.panel());
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [aceptar, setAceptar] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  useActualizacionVisible(c.actualizar, ocupado || c.cargando || aceptar !== null || seleccionada !== null);

  async function operar(fn: () => Promise<void>, orden?: number) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError('');
    try {
      await fn();
      setAceptar(null);
      if (orden) setSeleccionada(orden);
      c.actualizar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos completar la operación.');
      c.actualizar();
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  if (seleccionada) {
    return <ServicioTecnicoDetalle id={seleccionada}
      onVolver={() => { setSeleccionada(null); c.actualizar(); }} />;
  }

  const etiquetas = { disponible: 'Disponible', ocupado: 'Ocupado', fuera_servicio: 'Fuera de servicio' };
  const datos = c.datos;
  const ofertas: OfertaTecnico[] = datos && Array.isArray(datos.ofertas) ? datos.ofertas : [];
  const solicitudes: ServicioTecnico[] = datos && Array.isArray(datos.solicitudes) ? datos.solicitudes : [];
  const ofertasNoIncluidas = Boolean(datos && !Array.isArray(datos.ofertas));
  const solicitudesNoIncluidas = Boolean(datos && !Array.isArray(datos.solicitudes));
  const sinTrabajo = datos && !ofertas.length && !solicitudes.length && !c.cargando;

  return <MarcoContenido>
    <Encabezado titulo="Atenciones de la empresa"
      subtitulo="Solicitudes compatibles con tu especialidad, zona y disponibilidad. Las ofertas se actualizan mientras esta pantalla está visible." />
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar solicitudes" variante="secundario"
      deshabilitado={ocupado || c.cargando} onPress={c.actualizar} />
    {ofertasNoIncluidas ? <Aviso tono="advertencia">El servidor no incluye ofertas asignadas. Las solicitudes compatibles siguen disponibles.</Aviso> : null}
    {solicitudesNoIncluidas ? <Aviso tono="advertencia">El servidor no devolvió las solicitudes compatibles.</Aviso> : null}
    {c.cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {datos ? <>
      <Tarjeta style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Ionicons name={datos.disponibilidad === 'disponible' ? 'radio-button-on' : 'radio-button-off'}
            size={18} color={datos.disponibilidad === 'disponible' ? colores.exito : colores.secundario} />
          <Texto variante="subtitulo">{etiquetas[datos.disponibilidad]}</Texto>
        </View>
        <Texto>{datos.activos} servicios activos · {datos.finalizados} finalizados</Texto>
        <BotonPrimario titulo={datos.disponibilidad === 'disponible' ? 'Ponerme fuera de servicio' : 'Ponerme disponible'}
          deshabilitado={ocupado || c.cargando || datos.activos > 0}
          onPress={() => void operar(() => operacionRepository.disponibilidad(datos.disponibilidad !== 'disponible'))} />
        {datos.activos > 0 ? <Texto>Abre Servicios para continuar tu orden activa. No puedes aceptar otra mientras esté abierta.</Texto> : null}
        {datos.disponibilidad !== 'disponible' && datos.activos === 0 ?
          <Texto variante="caption">Mientras estés fuera de servicio no recibirás nuevas ofertas.</Texto> : null}
      </Tarjeta>

      {ofertas.length ? <>
        <Texto variante="subtitulo">Ofertas para ti</Texto>
        <Texto variante="caption">Tienes poco tiempo para responder. Si rechazas o expira, el pedido se ofrece a otro técnico.</Texto>
        {ofertas.map(o => <TarjetaOferta key={o.oferta} oferta={o} ocupado={ocupado || c.cargando}
          confirmando={aceptar === o.oferta}
          onPedirConfirmacion={() => setAceptar(o.oferta)}
          onCancelar={() => setAceptar(null)}
          onAceptar={() => void operar(() => operacionRepository.aceptarOferta(o.oferta), o.orden)}
          onRechazar={() => void operar(() => operacionRepository.rechazarOferta(o.oferta))}
          onExpirar={c.actualizar} />)}
      </> : null}

      <Texto variante="subtitulo">Otras solicitudes compatibles</Texto>
      <Texto variante="caption">La dirección y el nombre del cliente se muestran únicamente después de aceptar.</Texto>
      {sinTrabajo ? <Tarjeta style={{ gap: 8 }}>
        <Texto variante="cuerpoFuerte">No hay solicitudes por ahora</Texto>
        <Texto>{datos.disponibilidad !== 'disponible'
          ? 'Activa tu disponibilidad para recibir pedidos de tu cobertura.'
          : 'Cuando un cliente pida un servicio dentro de tu cobertura, aparecerá aquí.'}</Texto>
      </Tarjeta> : null}
      {solicitudes.map(s => <Tarjeta key={s.id} style={{ gap: 12 }}>
        <Texto variante="cuerpoFuerte">Solicitud #{s.id} · {s.categoria}</Texto>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {s.urgencia ? <Chip texto="Urgente" tono="advertencia" /> : <Chip texto="Sin urgencia" />}
          <Chip texto={fechaHoraBolivia(s.creadoEn)} />
        </View>
        <BotonPrimario titulo={`Aceptar solicitud ${s.id}`} deshabilitado={ocupado || c.cargando || aceptar !== null}
          onPress={() => setAceptar(s.id)} />
        {aceptar === s.id ? <>
          <Aviso tono="advertencia">Confirma que puedes atenderla. Se asignará solo si sigue disponible y cumples los requisitos.
            Aceptar no activa el GPS ni confirma un precio final.</Aviso>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <BotonPrimario titulo="Confirmar aceptación del servicio" cargando={ocupado}
              onPress={() => void operar(() => operacionRepository.aceptar(s.id), s.id)} />
            <BotonPrimario titulo="No aceptar ahora" variante="secundario" deshabilitado={ocupado} onPress={() => setAceptar(null)} />
          </View>
        </> : null}
      </Tarjeta>)}
    </> : null}
  </MarcoContenido>;
}

function TarjetaOferta({ oferta, ocupado, confirmando, onPedirConfirmacion, onCancelar, onAceptar, onRechazar, onExpirar }: {
  oferta: OfertaTecnico;
  ocupado: boolean;
  confirmando: boolean;
  onPedirConfirmacion: () => void;
  onCancelar: () => void;
  onAceptar: () => void;
  onRechazar: () => void;
  onExpirar: () => void;
}) {
  const restante = useCuentaRegresiva(oferta.expiraEn, onExpirar);
  return <Tarjeta style={{ gap: 12, borderColor: colores.marca }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Ionicons name="construct" size={20} color={colores.marca} />
      <Texto variante="subtitulo">{oferta.categoria}</Texto>
      {oferta.urgencia ? <Chip texto="Urgente" tono="advertencia" /> : null}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name="navigate-outline" size={16} color={colores.secundario} />
      <Texto>{distanciaLegible(oferta.distanciaMetros)}</Texto>
    </View>
    <Texto variante="cuerpoFuerte" color={restante <= 30 ? colores.peligro : colores.tinta}>
      {restante > 0 ? `Responde en ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}` : 'Oferta expirada'}
    </Texto>
    <Texto variante="caption">Pedido #{oferta.orden}. El precio se cotiza después del diagnóstico; aceptar no confirma un importe.</Texto>
    {!confirmando ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <BotonPrimario titulo="Aceptar oferta" deshabilitado={ocupado || restante <= 0} onPress={onPedirConfirmacion} />
      <BotonPrimario titulo="No puedo atenderla" variante="secundario" deshabilitado={ocupado} onPress={onRechazar} />
    </View> : <>
      <Aviso tono="advertencia">Si aceptas, el servicio queda asignado a tu cuenta y debes dirigirte al cliente.</Aviso>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <BotonPrimario titulo="Confirmar y tomar el servicio" cargando={ocupado} onPress={onAceptar} />
        <BotonPrimario titulo="Volver" variante="secundario" deshabilitado={ocupado} onPress={onCancelar} />
      </View>
    </>}
  </Tarjeta>;
}

function useCuentaRegresiva(expiraEn: string, onExpirar: () => void) {
  const [restante, setRestante] = useState(() => Math.max(0, Math.floor((new Date(expiraEn).getTime() - Date.now()) / 1000)));
  const avisado = useRef(false);
  const expirar = useRef(onExpirar);
  expirar.current = onExpirar;
  useEffect(() => {
    const limite = new Date(expiraEn).getTime();
    const timer = setInterval(() => {
      const segundos = Math.max(0, Math.floor((limite - Date.now()) / 1000));
      setRestante(segundos);
      if (segundos === 0 && !avisado.current) {
        avisado.current = true;
        expirar.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiraEn]);
  return restante;
}

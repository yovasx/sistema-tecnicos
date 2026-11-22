import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { operacionRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { ServicioTecnicoDetalle } from './ServicioTecnicoDetalle';
import { fechaHoraBolivia } from '../../ui/formato';

export function PanelTecnico() {
  const c = useConsulta(() => operacionRepository.panel());
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [aceptar, setAceptar] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  async function operar(fn: () => Promise<void>, orden?: number) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await fn(); setAceptar(null); if (orden) setSeleccionada(orden); c.actualizar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos completar la operación.'); c.actualizar(); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  if (seleccionada) return <ServicioTecnicoDetalle id={seleccionada} onVolver={() => { setSeleccionada(null); c.actualizar(); }} />;
  const etiquetas = { disponible: 'Disponible', ocupado: 'Ocupado', fuera_servicio: 'Fuera de servicio' };
  return <MarcoContenido>
    <Encabezado titulo="Panel técnico" subtitulo="Disponibilidad y solicitudes compatibles con tu especialidad y cobertura." />
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar panel" variante="secundario" deshabilitado={ocupado || c.cargando} onPress={c.actualizar} />
    {c.cargando ? <ActivityIndicator /> : null}
    {c.datos ? <>
      <Tarjeta style={{ gap: 12 }}>
        <Texto variante="subtitulo">{etiquetas[c.datos.disponibilidad]}</Texto>
        <Texto>{c.datos.activos} servicios activos · {c.datos.finalizados} finalizados</Texto>
        <BotonPrimario titulo={c.datos.disponibilidad === 'disponible' ? 'Ponerme fuera de servicio' : 'Ponerme disponible'}
          deshabilitado={ocupado || c.cargando || c.datos.activos > 0}
          onPress={() => void operar(() => operacionRepository.disponibilidad(c.datos!.disponibilidad !== 'disponible'))} />
        {c.datos.activos > 0 ? <Texto>Abre Servicios para continuar tu orden activa. No puedes aceptar otra mientras esté abierta.</Texto> : null}
      </Tarjeta>
      <Texto variante="subtitulo">Solicitudes disponibles</Texto>
      <Texto variante="caption">Hasta 30 solicitudes compatibles. La dirección y el nombre del cliente se muestran únicamente después de aceptar.</Texto>
      {!c.datos.solicitudes.length && !c.cargando ? <Tarjeta><Texto>{c.datos.disponibilidad !== 'disponible'
        ? 'Activa tu disponibilidad para consultar solicitudes de tu cobertura.' : 'No hay solicitudes compatibles disponibles.'}</Texto></Tarjeta> : null}
      {c.datos.solicitudes.map(s => <Tarjeta key={s.id} style={{ gap: 12 }}>
        <Texto variante="cuerpoFuerte">Solicitud #{s.id} · {s.categoria}</Texto>
        <Texto>{s.urgencia ? 'Urgente' : 'Sin urgencia'} · {fechaHoraBolivia(s.creadoEn)}</Texto>
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

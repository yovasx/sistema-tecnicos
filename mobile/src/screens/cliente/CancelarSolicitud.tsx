import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { operacionRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { CampoTexto } from '../../ui/CampoTexto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

export function CancelarSolicitud({ orden, onCambio, onEdicion }: {
  orden: number; onCambio: () => void; onEdicion: (activa: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const bloqueo = useRef(false);
  useCambiosSinGuardar(abierto && !!motivo, ocupado);
  useEffect(() => { onEdicion(abierto || ocupado); return () => onEdicion(false); }, [abierto, ocupado, onEdicion]);
  async function cancelar() {
    if (bloqueo.current || motivo.trim().length < 5) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await operacionRepository.cancelar(orden, motivo.trim()); setAbierto(false); setMotivo(''); onCambio(); }
    catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos confirmar la cancelación.');
      setIncierto(!(e instanceof ErrorApi) || !e.estado || e.estado >= 500);
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">Opciones de la solicitud</Texto>
    <Texto>Solo puedes cancelar mientras no haya un técnico asignado.</Texto>
    {!abierto ? <BotonPrimario titulo="Cancelar solicitud no asignada" variante="secundario" onPress={() => setAbierto(true)} /> : <>
      <CampoTexto etiqueta="Motivo de cancelación" value={motivo} onChangeText={setMotivo}
        maxLength={500} multiline editable={!ocupado && !incierto} />
      <Aviso tono="advertencia">Confirma la cancelación de esta solicitud. No se cancelará si un técnico ya la aceptó.</Aviso>
      {incierto ? <Aviso>No se confirmó el resultado. Reintenta o vuelve a consultar el estado; no se crea otra orden.</Aviso> : null}
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <BotonPrimario titulo={incierto ? 'Reintentar cancelación' : 'Confirmar cancelación'} cargando={ocupado}
          deshabilitado={motivo.trim().length < 5} onPress={() => void cancelar()} />
        <BotonPrimario titulo="Volver al detalle" variante="secundario" deshabilitado={ocupado}
          onPress={() => { setAbierto(false); setMotivo(''); if (incierto) onCambio(); setIncierto(false); }} />
      </View>
    </>}
  </Tarjeta>;
}

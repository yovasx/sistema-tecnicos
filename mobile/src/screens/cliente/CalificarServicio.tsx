import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { hogarRepository } from '../../infrastructure/di';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Aviso } from '../../ui/Aviso';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

export function CalificarServicio({ orden, actual, onGuardada, tecnico = false, bloqueado = false, onEdicion }: {
  orden: number; actual: number | null; onGuardada: () => void; tecnico?: boolean; bloqueado?: boolean; onEdicion?: (activa: boolean) => void;
}) {
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  useCambiosSinGuardar(!guardada && actual == null && (!!puntaje || !!comentario), ocupado);
  useEffect(() => {
    onEdicion?.(ocupado || !guardada && actual == null && (!!puntaje || !!comentario));
    return () => onEdicion?.(false);
  }, [guardada, actual, puntaje, comentario, ocupado, onEdicion]);
  async function guardar() {
    if (bloqueo.current || !puntaje) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await hogarRepository.calificar(orden, puntaje, comentario, tecnico); setGuardada(true); onGuardada(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos guardar tu valoración.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">{tecnico ? 'Tu valoración del cliente' : 'Tu valoración del servicio'}</Texto>
    {actual != null || guardada ? <Texto>Calificación registrada: {actual ?? puntaje} / 5.</Texto> : <>
      <Texto>Califica de 1 a 5. Solo se permite una valoración por servicio finalizado.</Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => <BotonPrimario key={n} titulo={`${n} ${puntaje === n ? '★' : '☆'}`}
          variante={puntaje === n ? 'primario' : 'secundario'} deshabilitado={ocupado || bloqueado} onPress={() => setPuntaje(n)} />)}
      </View>
      <CampoTexto etiqueta="Comentario (opcional)" value={comentario} onChangeText={setComentario}
        multiline maxLength={1000} editable={!ocupado && !bloqueado} />
      <Texto variante="caption">Evita teléfonos, direcciones y datos personales. El comentario no se publica como reseña pública.</Texto>
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      <BotonPrimario titulo="Confirmar valoración" cargando={ocupado} deshabilitado={!puntaje || bloqueado} onPress={() => void guardar()} />
    </>}
  </Tarjeta>;
}

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { coberturaRepository as repo } from '../../infrastructure/di';
import { PropuestaCobertura } from '../../domain/models/Cobertura';
import { useConsulta } from '../useConsulta';
import { MapaCobertura } from '../tecnico/MapaCobertura';
import { estadosPropuesta } from '../tecnico/CoberturaTecnico';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Encabezado } from '../../ui/Encabezado';
import { fechaHoraBolivia } from '../../ui/formato';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

export function CoberturasAdminScreen() {
  const [pagina, setPagina] = useState(0);
  const [tecnico, setTecnico] = useState<number | null>(null);
  const c = useConsulta(() => repo.pendientes(pagina), [pagina]);
  if (tecnico !== null) return <View style={{ gap: 20 }}>
    <Encabezado titulo={`Cobertura del técnico #${tecnico}`} />
    <FichaCoberturaAdmin id={tecnico} onVolver={() => { setTecnico(null); c.actualizar(); }} />
  </View>;
  return <View style={{ gap: 20 }}>
    <Encabezado titulo="Revisar coberturas" subtitulo="Propuestas geográficas pendientes, separadas de la aprobación documental." />
    <BotonPrimario titulo="Actualizar propuestas pendientes" variante="secundario" deshabilitado={c.cargando} onPress={c.actualizar} />
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    {c.cargando ? <ActivityIndicator /> : null}
    {c.datos && !c.error ? <>
      <Texto>{c.datos.total} propuestas pendientes</Texto>
      {c.datos.elementos.map(s => <Tarjeta key={s.id} style={{ gap: 12 }}>
        <Texto variante="subtitulo">Propuesta #{s.id} · Técnico #{s.tecnicoId}</Texto>
        <Texto>{s.motivo}</Texto><Texto variante="caption">{fechaHoraBolivia(s.creadaEn)}</Texto>
        <BotonPrimario titulo={`Revisar propuesta ${s.id}`} deshabilitado={c.cargando} onPress={() => setTecnico(s.tecnicoId)} />
      </Tarjeta>)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <BotonPrimario titulo="Página anterior" variante="secundario" deshabilitado={c.cargando || pagina === 0} onPress={() => setPagina(p => p - 1)} />
        <Texto>Página {pagina + 1}</Texto>
        <BotonPrimario titulo="Página siguiente" variante="secundario" deshabilitado={c.cargando || (pagina + 1) * 20 >= c.datos.total} onPress={() => setPagina(p => p + 1)} />
      </View>
    </> : null}
  </View>;
}

export function FichaCoberturaAdmin({ id, onInteraccion, onVolver }: {
  id: number; onInteraccion?: (sucio: boolean, ocupado: boolean) => void; onVolver?: () => void;
}) {
  const [pagina, setPagina] = useState(0);
  const [edicion, setEdicion] = useState(false);
  const c = useConsulta(() => repo.tecnico(id, pagina), [id, pagina]);
  return <View style={{ gap: 20 }}>
    {onVolver ? <BotonPrimario titulo="Volver a propuestas pendientes" variante="secundario" deshabilitado={edicion} onPress={onVolver} /> : null}
    <BotonPrimario titulo="Actualizar revisión de cobertura" variante="secundario" deshabilitado={c.cargando || edicion} onPress={c.actualizar} />
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    {c.cargando ? <ActivityIndicator /> : null}
    {c.datos && !c.error ? <>
      <Tarjeta style={{ gap: 12 }}>
        <Texto variante="subtitulo">Cobertura vigente · Revisión {c.datos.revision}</Texto>
        {c.datos.zonas.map(z => <Texto key={z.id}>{z.nombre || 'Zona sin nombre'}</Texto>)}
        <MapaCobertura datos={c.datos} />
      </Tarjeta>
      {c.datos.solicitudes.map(s => <Tarjeta key={s.id} style={{ gap: 12 }}>
        <Texto variante="subtitulo">Propuesta #{s.id} · {estadosPropuesta[s.estado]}</Texto>
        <Texto>{s.motivo}</Texto><Texto variante="caption">{fechaHoraBolivia(s.creadaEn)}</Texto>
        {s.zonas.map((z, i) => <Texto key={i}>{z.nombre}: {z.latitud}, {z.longitud} · radio {z.radioMetros} m</Texto>)}
        {s.motivoRevision ? <Aviso>Motivo de decisión: {s.motivoRevision}</Aviso> : null}
        {s.estado === 'pendiente' ? <>
          <MapaCobertura datos={c.datos!} propuestas={s.zonas} />
          <DecisionCobertura solicitud={s} onGuardada={c.actualizar}
            onInteraccion={(sucio, ocupado) => { setEdicion(sucio || ocupado); onInteraccion?.(sucio, ocupado); }} />
        </> : null}
      </Tarjeta>)}
      {!c.datos.totalSolicitudes ? <Texto>No hay propuestas registradas para este técnico.</Texto> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <BotonPrimario titulo="Propuestas anteriores" variante="secundario" deshabilitado={edicion || c.cargando || pagina === 0} onPress={() => setPagina(p => p - 1)} />
        <Texto>Página {pagina + 1}</Texto>
        <BotonPrimario titulo="Más propuestas" variante="secundario" deshabilitado={edicion || c.cargando || (pagina + 1) * 20 >= c.datos.totalSolicitudes} onPress={() => setPagina(p => p + 1)} />
      </View>
    </> : null}
  </View>;
}
function DecisionCobertura({ solicitud: s, onGuardada, onInteraccion }: {
  solicitud: PropuestaCobertura; onGuardada: () => void; onInteraccion: (sucio: boolean, ocupado: boolean) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [decision, setDecision] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  const callback = useRef(onInteraccion); callback.current = onInteraccion;
  useCambiosSinGuardar(motivo !== '' || decision !== null, ocupado);
  useEffect(() => {
    callback.current(motivo !== '' || decision !== null, ocupado);
    return () => callback.current(false, false);
  }, [motivo, decision, ocupado]);
  async function guardar() {
    if (bloqueo.current || decision === null || motivo.trim().length < 5) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await repo.revisar(s.id, s.revision, decision, motivo.trim()); setDecision(null); setMotivo(''); onGuardada(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos registrar la decisión.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <>
    <Aviso tono="advertencia">Aprobar sustituye todas las zonas vigentes. Exige técnico activo, aprobado, fuera de servicio y sin órdenes abiertas.
      No cambia sus especialidades, identidad ni disponibilidad.</Aviso>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    <CampoTexto etiqueta="Motivo de la decisión de cobertura" value={motivo} maxLength={500} multiline editable={!ocupado}
      onChangeText={v => { setMotivo(v); setDecision(null); }} />
    {decision === null ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <BotonPrimario titulo="Aprobar cobertura propuesta" deshabilitado={ocupado || motivo.trim().length < 5} onPress={() => setDecision(true)} />
      <BotonPrimario titulo="Rechazar cobertura propuesta" variante="secundario" deshabilitado={ocupado || motivo.trim().length < 5} onPress={() => setDecision(false)} />
      <BotonPrimario titulo="Limpiar decisión sin enviar" variante="secundario" deshabilitado={ocupado} onPress={() => { setMotivo(''); setError(''); }} />
    </View> : <>
      <Aviso tono="advertencia">Confirma: {decision ? 'aprobar y sustituir la cobertura' : 'rechazar sin modificar la cobertura vigente'}.</Aviso>
      <BotonPrimario titulo="Confirmar decisión de cobertura" cargando={ocupado} onPress={() => void guardar()} />
      <BotonPrimario titulo="Cancelar decisión de cobertura" variante="secundario" deshabilitado={ocupado}
        onPress={() => { setDecision(null); setMotivo(''); setError(''); }} />
    </>}
  </>;
}

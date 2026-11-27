import { useState } from 'react';
import { View } from 'react-native';
import { Equipo, Sucursal } from '../../domain/models/GestionLocal';
import { gestionLocalRepository as repo } from '../../infrastructure/di';
import { useSesion } from '../../session/SesionProvider';
import { useSolicitudServicio } from '../../session/SolicitudServicioProvider';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { fechaHoraBolivia } from '../../ui/formato';

export function EquiposCliente() {
  const { usuario } = useSesion();
  const empresa = usuario?.tipoCliente === 'empresa';
  const { abrir } = useSolicitudServicio();
  const c = useConsulta(async () => ({ equipos: await repo.equipos(), sucursales: await repo.sucursales() }));
  const [editar, setEditar] = useState<Partial<Equipo> | null>(null);
  const [sucursal, setSucursal] = useState<Partial<Sucursal> | null>(null);
  const [historial, setHistorial] = useState<Equipo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [confirmarArchivo, setConfirmarArchivo] = useState<number | null>(null);
  useCambiosSinGuardar(!!editar || !!sucursal, ocupado);
  async function guardar(fn: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true); setError('');
    try { await fn(); setEditar(null); setSucursal(null); setConfirmarArchivo(null); c.actualizar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos guardar los datos.'); }
    finally { setOcupado(false); }
  }
  if (historial) return <Historial equipo={historial} onVolver={() => setHistorial(null)} />;
  const bloqueado = ocupado || !!editar || !!sucursal;
  return <MarcoContenido>
    <Encabezado titulo={empresa ? 'Equipos y sucursales' : 'Mis equipos'}
      subtitulo="Conserva el historial de atención de cada equipo. Editar sus datos no modifica solicitudes anteriores." />
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    <View style={fila}>
      <BotonPrimario titulo="Registrar equipo" deshabilitado={bloqueado} onPress={() => setEditar({ nombre: '', activo: true, sucursal: null })} />
      {empresa ? <BotonPrimario titulo="Registrar sucursal" variante="secundario" deshabilitado={bloqueado}
        onPress={() => setSucursal({ nombre: '', referencia: '', activa: true })} /> : null}
      <BotonPrimario titulo="Actualizar equipos" variante="secundario" deshabilitado={bloqueado || c.cargando} onPress={c.actualizar} />
    </View>
    {editar ? <Tarjeta style={{ gap: 12 }}>
      <Texto variante="subtitulo">{editar.id ? 'Editar equipo' : 'Nuevo equipo'}</Texto>
      <CampoTexto etiqueta="Nombre del equipo" value={editar.nombre ?? ''} maxLength={100} editable={!ocupado}
        onChangeText={nombre => setEditar(e => ({ ...e, nombre }))} />
      <CampoTexto etiqueta="Marca (opcional)" value={editar.marca ?? ''} maxLength={100} editable={!ocupado}
        onChangeText={marca => setEditar(e => ({ ...e, marca }))} />
      <CampoTexto etiqueta="Modelo (opcional)" value={editar.modelo ?? ''} maxLength={100} editable={!ocupado}
        onChangeText={modelo => setEditar(e => ({ ...e, modelo }))} />
      <CampoTexto etiqueta="Código interno o serie (opcional)" value={editar.identificador ?? ''} maxLength={100} editable={!ocupado}
        onChangeText={identificador => setEditar(e => ({ ...e, identificador }))} />
      {empresa ? <FiltroAdmin etiqueta="Sucursal" valor={String(editar.sucursal ?? '')} deshabilitado={ocupado}
        opciones={[['', 'Sin sucursal'], ...(c.datos?.sucursales.filter(s => s.activa).map(s => [String(s.id), s.nombre] as const) ?? [])]}
        onChange={v => setEditar(e => ({ ...e, sucursal: v ? Number(v) : null }))} /> : null}
      <View style={fila}><BotonPrimario titulo="Guardar equipo" cargando={ocupado} deshabilitado={(editar.nombre?.trim().length ?? 0) < 2}
        onPress={() => void guardar(() => repo.guardarEquipo({
          id: editar.id, revision: editar.revision, nombre: editar.nombre!.trim(), marca: editar.marca ?? null,
          modelo: editar.modelo ?? null, identificador: editar.identificador ?? null, activo: editar.activo ?? true,
          sucursal: editar.sucursal ?? null,
        }))} /><BotonPrimario titulo="Descartar edición" variante="secundario" deshabilitado={ocupado} onPress={() => setEditar(null)} /></View>
    </Tarjeta> : null}
    {sucursal ? <Tarjeta style={{ gap: 12 }}>
      <Texto variante="subtitulo">{sucursal.id ? 'Editar sucursal' : 'Nueva sucursal'}</Texto>
      <CampoTexto etiqueta="Nombre de sucursal" value={sucursal.nombre ?? ''} maxLength={100} editable={!ocupado}
        onChangeText={nombre => setSucursal(s => ({ ...s, nombre }))} />
      <CampoTexto etiqueta="Dirección o referencia de sucursal" value={sucursal.referencia ?? ''} maxLength={300} editable={!ocupado}
        onChangeText={referencia => setSucursal(s => ({ ...s, referencia }))} />
      <View style={fila}><BotonPrimario titulo="Guardar sucursal" cargando={ocupado}
        deshabilitado={(sucursal.nombre?.trim().length ?? 0) < 2 || (sucursal.referencia?.trim().length ?? 0) < 5}
        onPress={() => void guardar(() => repo.guardarSucursal({
          id: sucursal.id, revision: sucursal.revision, nombre: sucursal.nombre!.trim(),
          referencia: sucursal.referencia!.trim(), activa: sucursal.activa ?? true,
        }))} /><BotonPrimario titulo="Descartar sucursal" variante="secundario" deshabilitado={ocupado} onPress={() => setSucursal(null)} /></View>
    </Tarjeta> : null}
    {empresa && c.datos?.sucursales.length ? <Texto variante="subtitulo">Sucursales</Texto> : null}
    {empresa ? c.datos?.sucursales.map(s => <Tarjeta key={`s${s.id}`} style={{ gap: 8 }}>
      <Texto variante="cuerpoFuerte">{s.nombre}{s.activa ? '' : ' · Archivada'}</Texto><Texto>{s.referencia}</Texto>
      <View style={fila}><BotonPrimario titulo={`Editar ${s.nombre}`} variante="secundario" deshabilitado={bloqueado} onPress={() => setSucursal(s)} />
        <BotonPrimario titulo={s.activa ? 'Archivar sucursal' : 'Reactivar sucursal'} variante="secundario" deshabilitado={bloqueado}
          onPress={() => void guardar(() => repo.guardarSucursal({ ...s, activa: !s.activa }))} /></View>
    </Tarjeta>) : null}
    <Texto variante="subtitulo">Equipos registrados</Texto>
    {!c.cargando && !c.datos?.equipos.length ? <Texto>Todavía no registraste equipos. También puedes solicitar un servicio sin registrar uno.</Texto> : null}
    {c.datos?.equipos.map(e => <Tarjeta key={e.id} style={{ gap: 10 }}>
      <Texto variante="subtitulo">{e.nombre}{e.activo ? '' : ' · Archivado'}</Texto>
      <Texto>{[e.marca, e.modelo, e.identificador].filter(Boolean).join(' · ') || 'Sin datos adicionales'}</Texto>
      {e.sucursal ? <Texto variante="caption">Sucursal: {c.datos?.sucursales.find(s => s.id === e.sucursal)?.nombre ?? 'No disponible'}</Texto> : null}
      <View style={fila}>
        <BotonPrimario titulo="Ver historial de mantenimiento" variante="secundario" deshabilitado={bloqueado} onPress={() => setHistorial(e)} />
        <BotonPrimario titulo="Editar equipo" variante="secundario" deshabilitado={bloqueado} onPress={() => setEditar(e)} />
        {e.activo ? <BotonPrimario titulo="Pedir atención para este equipo" deshabilitado={bloqueado} onPress={() => abrir(undefined, e.id)} /> : null}
        <BotonPrimario titulo={e.activo ? confirmarArchivo === e.id ? 'Confirmar archivo del equipo' : 'Archivar equipo' : 'Reactivar equipo'}
          variante="secundario" deshabilitado={bloqueado} onPress={() => {
            if (e.activo && confirmarArchivo !== e.id) { setConfirmarArchivo(e.id); return; }
            void guardar(() => repo.guardarEquipo({ ...e, activo: !e.activo }));
          }} />
      </View>
    </Tarjeta>)}
    <Texto variante="caption">Hasta 100 equipos y 20 sucursales por cuenta. Archivar conserva el historial.</Texto>
  </MarcoContenido>;
}
function Historial({ equipo, onVolver }: { equipo: Equipo; onVolver: () => void }) {
  const c = useConsulta(() => repo.historialEquipo(equipo.id), [equipo.id]);
  return <MarcoContenido><BotonPrimario titulo="Volver a equipos" variante="secundario" onPress={onVolver} />
    <Encabezado titulo={`Historial · ${equipo.nombre}`} subtitulo="Últimas 100 atenciones vinculadas a este equipo." />
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    {!c.cargando && !c.datos?.length ? <Texto>Sin atenciones registradas para este equipo.</Texto> : null}
    {c.datos?.map(h => <Tarjeta key={h.orden} style={{ gap: 8 }}>
      <Texto variante="subtitulo">Orden #{h.orden} · {h.categoria}</Texto>
      <Texto>{h.estado.replaceAll('_', ' ')} · {fechaHoraBolivia(h.creadoEn)}</Texto>
      {h.trabajo ? <Texto>{h.trabajo}</Texto> : null}
      {h.conformidad ? <Texto>Conformidad: {h.conformidad.replaceAll('_', ' ')}</Texto> : null}
      {h.proximoMantenimiento ? <Aviso>Próximo mantenimiento recomendado: {h.proximoMantenimiento}</Aviso> : null}
    </Tarjeta>)}
  </MarcoContenido>;
}
const fila = { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } as const;

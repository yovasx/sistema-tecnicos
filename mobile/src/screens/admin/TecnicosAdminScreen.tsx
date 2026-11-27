import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CambioUsuarioAdmin, CategoriaAdmin } from '../../domain/models/Admin';
import { DetalleTecnicoAdmin, FiltrosTecnicos, PaginaTecnicos, RevisionTecnicoAdmin, FilaTecnicoAdmin } from '../../domain/models/TecnicoAdmin';
import { adminRepository, tecnicosAdminRepository as repo } from '../../infrastructure/di';
import { leerRutaAdmin, guardarRutaAdmin } from '../../infrastructure/navigation/rutaAdmin';
import { useResponsive } from '../../theme/responsive';
import { colores } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip } from '../../ui/Chip';
import { Texto } from '../../ui/Texto';
import { Tarjeta } from '../../ui/Tarjeta';
import { Encabezado } from '../../ui/Encabezado';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { TablaAdmin } from '../../ui/admin/TablaAdmin';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { ExpedienteTecnicoAdmin, estadosDisponibilidad, estadosExpediente, camposExpediente } from './ExpedienteTecnicoAdmin';
import { InvitarUsuarioAdmin } from './InvitarUsuarioAdmin';
import { FormularioCuentaAdmin } from './FormularioCuentaAdmin';
import { FichaCoberturaAdmin } from './CoberturasAdminScreen';

const inicial: FiltrosTecnicos = { busqueda: '', cuenta: 'todos', expediente: 'todos', disponibilidad: 'todos', pagina: 0, tamano: 20 };
const errorTexto = (e: unknown) => e instanceof Error ? e.message : 'No pudimos completar la consulta.';
const fecha = (v: string) => new Date(v).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
const etiquetasObservacion = Object.fromEntries(camposExpediente);

export function TecnicosAdminScreen() {
  const { ancho } = useResponsive();
  const [filtros, setFiltros] = useState(inicial);
  const [busqueda, setBusqueda] = useState('');
  const [datos, setDatos] = useState<PaginaTecnicos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [errorCategorias, setErrorCategorias] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const [id, setId] = useState<number | null>(() => leerRutaAdmin().usuario);
  const [invitando, setInvitando] = useState(false);
  const consulta = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => setFiltros(f => ({ ...f, busqueda, pagina: 0 })), 350);
    return () => clearTimeout(timer);
  }, [busqueda]);
  useEffect(() => {
    const actual = ++consulta.current;
    setCargando(true); setError('');
    repo.listar(filtros).then(d => { if (actual === consulta.current) setDatos(d); })
      .catch(e => { if (actual === consulta.current) setError(errorTexto(e)); })
      .finally(() => { if (actual === consulta.current) setCargando(false); });
    return () => { consulta.current++; };
  }, [filtros, recarga]);
  useEffect(() => {
    let vigente = true;
    setErrorCategorias('');
    adminRepository.categorias().then(c => { if (vigente) setCategorias(c); })
      .catch(e => { if (vigente) setErrorCategorias(errorTexto(e)); });
    return () => { vigente = false; };
  }, [recarga]);
  function filtrar(k: 'cuenta' | 'expediente' | 'disponibilidad', v: string) {
    setFiltros(f => ({ ...f, [k]: v, pagina: 0 }));
  }
  function abrir(v: number | null) { guardarRutaAdmin('tecnicos', v); setId(v); }
  if (id !== null) return <FichaTecnicoAdmin key={id} id={id} onVolver={() => abrir(null)}
    onCambio={() => setRecarga(n => n + 1)} />;
  if (invitando) return <InvitarUsuarioAdmin rolFijo="tecnico" onVolver={() => setInvitando(false)} />;
  return <View style={s.raiz}>
    <View style={s.fila}><Ionicons name="construct-outline" size={18} color={colores.marca} /><Texto variante="caption">Personas / Gestión de técnicos</Texto></View>
    <Encabezado titulo="Técnicos" subtitulo="Perfil profesional, expediente y acceso. Sin confundir aprobación, cuenta activa y disponibilidad."
      derecha={<View style={s.fila}><BotonPrimario titulo="Actualizar técnicos" variante="secundario" tamano="escritorio" deshabilitado={cargando}
        onPress={() => setRecarga(n => n + 1)} /><BotonPrimario titulo="Invitar técnico" tamano="escritorio" onPress={() => setInvitando(true)} /></View>} />
    <View style={s.entre}><Texto variante="subtitulo">{datos?.total ?? '—'} {datos?.total === 1 ? 'técnico encontrado' : 'técnicos encontrados'}</Texto>
      <Chip texto="Datos reales · acceso administrativo" tono="marca" /></View>
    <Tarjeta style={{ gap: 20 }} relleno={20}>
      <CampoTexto etiqueta="Buscar técnicos" value={busqueda} onChangeText={setBusqueda} maxLength={150}
        autoCapitalize="none" placeholder="Nombre, correo o ID" />
      <View style={s.filtros}>
        <FiltroAdmin etiqueta="Cuenta" valor={filtros.cuenta} opciones={[['todos', 'Todas'], ['activo', 'Activas'], ['inactivo', 'Inactivas']]}
          onChange={v => filtrar('cuenta', v)} />
        <FiltroAdmin etiqueta="Expediente" valor={filtros.expediente}
          opciones={[['todos', 'Todos'], ...Object.entries(estadosExpediente)]} onChange={v => filtrar('expediente', v)} />
      </View>
      <View style={s.filtros}>
        <FiltroAdmin etiqueta="Disponibilidad declarada" valor={filtros.disponibilidad}
          opciones={[['todos', 'Todas'], ...Object.entries(estadosDisponibilidad)]} onChange={v => filtrar('disponibilidad', v)} />
        {categorias.length ? <FiltroAdmin etiqueta="Especialidad" valor={String(filtros.categoria ?? 'todos')}
          opciones={[['todos', 'Todas'], ...categorias.map(c => [String(c.id), `${c.nombre}${c.activa ? '' : ' (inactiva)'}`] as const)]}
          onChange={v => setFiltros(f => ({ ...f, categoria: v === 'todos' ? undefined : Number(v), pagina: 0 }))} /> : null}
      </View>
      {errorCategorias ? <Aviso tono="peligro" titulo="Especialidades no disponibles">{errorCategorias} Puedes reintentar con Actualizar técnicos.</Aviso> : null}
      <View style={s.entre}><Texto variante="caption">Más recientes primero. Los borradores también aparecen en este directorio.</Texto>
        <BotonPrimario titulo="Limpiar filtros" tamano="escritorio" variante="secundario"
          onPress={() => { setBusqueda(''); setFiltros(inicial); }} /></View>
    </Tarjeta>
    {error ? <Aviso tono="peligro" titulo="No pudimos cargar el directorio">{error}</Aviso> : null}
    {cargando ? <View style={s.fila}><ActivityIndicator color={colores.marca} /><Texto variante="caption">Cargando técnicos…</Texto></View> : null}
    {!error && datos ? <TablaAdmin filas={datos.elementos} clave={t => String(t.id)}
      pagina={datos.pagina} total={datos.total} tamano={datos.tamano} ocupado={cargando}
      onPagina={pagina => setFiltros(f => ({ ...f, pagina }))} anchoMinimo={ancho >= 1280 ? 980 : 700}
      columnas={[
        { clave: 'tecnico', titulo: 'TÉCNICO', render: t => <View style={{ gap: 4 }}>
          <Texto variante="etiqueta" numberOfLines={1}>{t.nombre}</Texto><Texto variante="caption" numberOfLines={1}>{t.email}</Texto>
          <Texto variante="caption" numberOfLines={1}>{t.especialidades.join(' · ') || 'Sin especialidades registradas'}</Texto></View> },
        { clave: 'cuenta', titulo: 'CUENTA', ancho: 110, render: t => <Chip texto={t.activo ? 'Activa' : 'Inactiva'} tono={t.activo ? 'exito' : 'neutro'} /> },
        { clave: 'expediente', titulo: 'EXPEDIENTE', ancho: 170, render: t => <View style={{ gap: 4 }}>
          <Chip texto={estadosExpediente[t.estadoExpediente]} tono={t.estadoValidacion === 'aprobado' ? 'exito' : 'neutro'} />
          {!t.expedienteRequerido ? <Texto variante="caption">Aprobación anterior</Texto> : null}</View> },
        ...(ancho >= 1280 ? [{ clave: 'disponibilidad', titulo: 'DISPONIBILIDAD', ancho: 170,
          render: (t: FilaTecnicoAdmin) => <Texto variante="caption">{estadosDisponibilidad[t.disponibilidad]}</Texto> }] : []),
        { clave: 'accion', titulo: 'ACCIÓN', ancho: 160, render: t => <BotonPrimario titulo="Ver técnico" etiquetaAccesible={`Ver técnico ${t.nombre}`}
          variante="secundario" tamano="escritorio" deshabilitado={cargando} onPress={() => abrir(t.id)} /> },
      ]} /> : null}
  </View>;
}

function FichaTecnicoAdmin({ id, onVolver, onCambio }: { id: number; onVolver: () => void; onCambio: () => void }) {
  const { ancho } = useResponsive();
  const [d, setDetalle] = useState<DetalleTecnicoAdmin | null>(null);
  const [vista, setVista] = useState('perfil');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [interaccion, setInteraccion] = useState({ sucio: false, ocupado: false });
  const [descartar, setDescartar] = useState(false);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const definirInteraccion = useCallback((sucio: boolean, ocupado: boolean) => setInteraccion({ sucio, ocupado }), []);
  useCambiosSinGuardar(interaccion.sucio, interaccion.ocupado);
  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setDetalle(await repo.detalle(id)); }
    catch (e) { setError(errorTexto(e)); }
    finally { setCargando(false); }
  }, [id]);
  useEffect(() => { void cargar(); }, [cargar]);
  function revisionCompletada() {
    setMensaje('Decisión documental registrada.'); onCambio(); void cargar();
  }
  const ocupado = cargando || interaccion.ocupado;
  return <View style={s.raiz}>
    <View style={s.entre}><BotonPrimario titulo="Volver a Técnicos" variante="secundario" tamano="escritorio" deshabilitado={ocupado}
      onPress={() => interaccion.sucio ? setDescartar(true) : onVolver()} />
      <Texto variante="caption">Personas / Técnicos / Ficha #{id}</Texto></View>
    {descartar ? <><Aviso tono="advertencia" titulo="Hay cambios sin guardar">Descarta el borrador para volver o continúa con la revisión.</Aviso>
      <View style={s.fila}><BotonPrimario titulo="Seguir en la ficha" tamano="escritorio" onPress={() => setDescartar(false)} />
        <BotonPrimario titulo="Descartar y volver" variante="secundario" tamano="escritorio" onPress={onVolver} /></View></> : null}
    {error ? <Aviso tono="peligro" titulo="No pudimos actualizar la ficha">{error} No se muestran cambios que no hayan sido confirmados por el servidor.</Aviso> : null}
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
    {cargando ? <ActivityIndicator color={colores.marca} /> : null}
    <View style={s.fila}><BotonPrimario titulo={d ? 'Actualizar ficha' : 'Reintentar ficha'} variante="secundario" tamano="escritorio"
      deshabilitado={ocupado || interaccion.sucio || editandoDatos} onPress={() => void cargar()} /></View>
    {d && !cargando && !error ? <>
      <View style={s.cabecera}>
        <View style={s.avatar}><Ionicons name="construct-outline" size={28} color={colores.marca} /></View>
        <View style={{ flex: 1, minWidth: 240, gap: 8 }}><Texto variante="titulo">{d.cuenta.nombre} {d.cuenta.apellido}</Texto>
          <Texto color={colores.secundario}>{d.cuenta.email}</Texto>
          <View style={s.fila}><Chip texto={d.cuenta.activo ? 'Cuenta activa' : 'Cuenta inactiva'} tono={d.cuenta.activo ? 'exito' : 'neutro'} />
            <Chip texto={`Expediente: ${estadosExpediente[d.expediente.estadoExpediente]}`} tono={d.cuenta.estadoValidacion === 'aprobado' ? 'exito' : 'neutro'} />
            <Chip texto={estadosDisponibilidad[d.expediente.disponibilidad]} /></View>
        </View>
      </View>
      {!d.expedienteRequerido ? <Aviso titulo="Aprobación anterior conservada">
        Este técnico fue aprobado antes del expediente actual. La ausencia de documentos nuevos no revoca esa aprobación ni supone verificaciones que nunca se realizaron.
      </Aviso> : null}
      <FiltroAdmin etiqueta="Ficha del técnico" valor={vista} deshabilitado={editandoDatos || interaccion.sucio || ocupado}
        opciones={[['perfil', 'Perfil y cobertura'], ['cobertura', 'Revisión de cobertura'], ['documentos', 'Documentos y revisión'], ['historial', 'Historial']]} onChange={setVista} />
      {vista === 'perfil' ? <View style={{ flexDirection: ancho >= 1360 ? 'row' : 'column', gap: 24 }}>
        <View style={{ flex: 2, minWidth: 0, gap: 24 }}>
          <Tarjeta style={{ gap: 20 }}>
            {editandoDatos ? <FormularioCuentaAdmin key={d.cuenta.revision} cuenta={d.cuenta}
              onInteraccion={definirInteraccion} onCancelar={() => setEditandoDatos(false)}
              onGuardado={(cuenta, texto) => {
                setDetalle(p => p ? { ...p, cuenta } : p);
                setEditandoDatos(false); setMensaje(texto); onCambio();
              }} /> : <>
            <Texto variante="subtitulo">Datos generales</Texto>
            <Dato etiqueta="Teléfono" valor={d.cuenta.telefono} />
            <Dato etiqueta="Registro de la cuenta" valor={fecha(d.cuenta.creadoEn)} />
            <Dato etiqueta="Enviado a revisión" valor={d.expediente.enviadoEn ? fecha(d.expediente.enviadoEn) : 'Sin envío registrado'} />
            <Dato etiqueta="Aprobación técnica" valor={d.cuenta.estadoValidacion === 'aprobado' ? 'Aprobado' : 'No aprobado'} />
            <Texto variante="caption">Edita los datos permitidos sin salir de esta ficha. La identidad aprobada conserva su protección documental.</Texto>
            <BotonPrimario titulo="Editar datos del técnico" tamano="escritorio" variante="secundario"
              deshabilitado={ocupado || interaccion.sucio}
              onPress={() => { setEditandoDatos(true); setMensaje(''); }} />
            {d.aprobadoEn ? <Dato etiqueta="Fecha de validación registrada" valor={fecha(d.aprobadoEn)} /> : null}
            {d.aprobadoPor ? <Dato etiqueta="Responsable de la validación" valor={d.aprobadoPor} /> : null}
            </>}
          </Tarjeta>
          <Tarjeta style={{ gap: 16 }}><Texto variante="subtitulo">Especialidades</Texto>
            <View style={s.fila}>{d.expediente.especialidades.length ? d.expediente.especialidades.map(e => <Chip key={e.id} texto={e.nombre} tono="marca" />) :
              <Texto color={colores.secundario}>No hay especialidades registradas.</Texto>}</View>
            <Texto variante="caption">Las especialidades son las declaradas en el expediente. No se editan ni se certifican desde este listado.</Texto>
          </Tarjeta>
          <Tarjeta style={{ gap: 16 }}><Texto variante="subtitulo">Cobertura declarada</Texto>
            {d.expediente.zonas.length ? d.expediente.zonas.map(z => <View key={z.id} style={s.zona}>
              <Ionicons name="location-outline" size={22} color={colores.marca} />
              <View style={{ flex: 1, gap: 4 }}><Texto variante="etiqueta">{z.nombre}</Texto>
                <Texto variante="caption">Radio aproximado: {z.radio.toLocaleString('es-BO')} m</Texto>
                <Texto variante="caption">Centro: {z.lat.toFixed(5)}, {z.lng.toFixed(5)}</Texto></View>
            </View>) : <Texto color={colores.secundario}>No hay zonas de cobertura registradas.</Texto>}
            <Texto variante="caption">Es el área de cobertura, no la ubicación actual del técnico. No hay seguimiento en vivo en esta vista.</Texto>
          </Tarjeta>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 24 }}>
          <Tarjeta style={{ gap: 16 }}><Texto variante="subtitulo">Estado operativo</Texto>
            <Dato etiqueta="Cuenta" valor={d.cuenta.activo ? 'Activa' : 'Inactiva'} />
            <Dato etiqueta="Aprobación" valor={d.cuenta.estadoValidacion === 'aprobado' ? 'Aprobado' :
              d.cuenta.estadoValidacion === 'rechazado' ? 'Rechazado' : 'Pendiente de aprobación'} />
            <Dato etiqueta="Disponibilidad declarada" valor={estadosDisponibilidad[d.expediente.disponibilidad]} />
            <Aviso>{!d.cuenta.activo ? 'La cuenta inactiva no puede acceder a Fixly.' : d.cuenta.estadoValidacion !== 'aprobado' ?
              'Tener una cuenta activa no habilita al técnico sin aprobación.' :
              'La cuenta está activa y el técnico conserva su aprobación. La recepción de ofertas también depende de disponibilidad, especialidad y cobertura.'}</Aviso>
          </Tarjeta>
          {!editandoDatos ? <EstadoCuentaTecnico key={d.cuenta.revision} detalle={d} onInteraccion={definirInteraccion}
             onGuardado={cuenta => { setDetalle(p => p ? { ...p, cuenta } : p); setMensaje('Estado de cuenta actualizado y auditado.'); onCambio(); }} />
            : null}
        </View>
      </View> : vista === 'cobertura' ? <FichaCoberturaAdmin id={id} onInteraccion={definirInteraccion} /> : vista === 'documentos' ? <Tarjeta>
        <ExpedienteTecnicoAdmin id={id} expediente={d.expediente} cuentaActiva={d.cuenta.activo}
          onCambio={revisionCompletada} onInteraccion={definirInteraccion} />
      </Tarjeta> : <HistorialTecnico id={id} revision={d.cuenta.revision} />}
    </> : null}
  </View>;
}

function EstadoCuentaTecnico({ detalle: d, onGuardado, onInteraccion }: {
  detalle: DetalleTecnicoAdmin; onGuardado: (cuenta: DetalleTecnicoAdmin['cuenta']) => void;
  onInteraccion: (sucio: boolean, ocupado: boolean) => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  useEffect(() => {
    onInteraccion(motivo !== '', ocupado);
    return () => onInteraccion(false, false);
  }, [motivo, ocupado, onInteraccion]);
  async function guardar() {
    if (bloqueo.current) return;
    if (motivo.trim().length < 5) { setError('Escribe un motivo de al menos 5 caracteres.'); return; }
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      const cuenta = await adminRepository.estadoUsuario(d.cuenta.id,
        { revision: d.cuenta.revision, activo: !d.cuenta.activo, motivo: motivo.trim() });
      setMotivo(''); setConfirmar(false); onGuardado(cuenta);
    } catch (e) { setError(errorTexto(e)); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 16 }}>
    <Texto variante="subtitulo">Acceso al sistema de la empresa</Texto>
    <Texto color={colores.secundario}>{d.cuenta.activo ? 'Desactivar la cuenta cierra sus sesiones sin borrar su aprobación ni su expediente.' :
      'Reactivar permite una nueva sesión. No aprueba documentos ni recupera sesiones anteriores.'}</Texto>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {!confirmar ? <BotonPrimario titulo={d.cuenta.activo ? 'Desactivar cuenta técnica' : 'Reactivar cuenta técnica'} variante="secundario"
      tamano="escritorio" onPress={() => setConfirmar(true)} /> : <>
      <Aviso tono="advertencia" titulo="Confirma el cambio">{d.cuenta.activo ?
        'El técnico dejará de acceder a Fixly. Si tiene órdenes en curso, primero deberás resolverlas.' :
        'El técnico podrá volver a iniciar sesión; su aprobación y disponibilidad no cambian.'}</Aviso>
      <CampoTexto etiqueta="Motivo del estado técnico" value={motivo} onChangeText={setMotivo} maxLength={500} editable={!ocupado} multiline autoFocus />
      <BotonPrimario titulo={d.cuenta.activo ? 'Confirmar desactivación técnica' : 'Confirmar reactivación técnica'} tamano="escritorio"
        cargando={ocupado} onPress={() => void guardar()} />
      <BotonPrimario titulo="Cancelar cambio de estado" variante="secundario" tamano="escritorio" deshabilitado={ocupado}
        onPress={() => { setMotivo(''); setConfirmar(false); setError(''); }} />
    </>}
  </Tarjeta>;
}

function HistorialTecnico({ id, revision }: { id: number; revision: number }) {
  const [tipo, setTipo] = useState('documental');
  const [pagina, setPagina] = useState(0);
  const [revisiones, setRevisiones] = useState<RevisionTecnicoAdmin[]>([]);
  const [cuenta, setCuenta] = useState<CambioUsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vigente = true; setCargando(true); setError('');
    const consulta = tipo === 'documental' ? repo.revisiones(id, pagina).then(d => { if (vigente) setRevisiones(d); }) :
      adminRepository.historialUsuario(id, pagina).then(d => { if (vigente) setCuenta(d); });
    consulta.catch(e => { if (vigente) setError(errorTexto(e)); }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id, tipo, pagina, revision, recarga]);
  const cantidad = tipo === 'documental' ? revisiones.length : cuenta.length;
  return <Tarjeta style={{ gap: 20 }}>
    <Texto variante="subtitulo">Historial del técnico</Texto>
    <FiltroAdmin etiqueta="Tipo de historial" valor={tipo} opciones={[['documental', 'Revisiones documentales'], ['cuenta', 'Cambios de cuenta']]}
      deshabilitado={cargando} onChange={v => { setTipo(v); setPagina(0); }} />
    <Texto variante="caption">Solo decisiones registradas. Las aprobaciones previas sin auditoría no se reconstruyen.</Texto>
    {error ? <><Aviso tono="peligro">{error}</Aviso><BotonPrimario titulo="Reintentar historial" tamano="escritorio" onPress={() => setRecarga(n => n + 1)} /></> : null}
    {cargando ? <ActivityIndicator color={colores.marca} /> : !error ? <>
      {!cantidad ? <Aviso>No hay registros en esta página del historial.</Aviso> : null}
      {tipo === 'documental' ? revisiones.map(r => <View key={r.id} style={s.evento}>
        <View style={s.entre}><Chip texto={estadosExpediente[r.decision]} /><Texto variante="caption">{fecha(r.creadoEn)}</Texto></View>
        <Texto variante="etiqueta">Revisó: {r.revisor}</Texto>
        {Object.entries(r.observaciones).map(([k, v]) => <Texto key={k}>{etiquetasObservacion[k] ?? (k === 'motivo' ? 'Motivo' : k)}: {v}</Texto>)}
      </View>) : cuenta.map(c => <View key={c.id} style={s.evento}>
        <Texto variante="etiqueta">{({ crear: 'Cuenta creada', editar: 'Datos actualizados', desactivar: 'Cuenta desactivada', reactivar: 'Cuenta reactivada' } as Record<string, string>)[c.accion] ?? c.accion}</Texto>
        <Texto variante="caption">{fecha(c.creadoEn)} · {c.administrador}</Texto><Texto>{c.motivo}</Texto>
      </View>)}
    </> : null}
    <View style={s.fila}><BotonPrimario titulo="Anteriores" variante="secundario" tamano="escritorio"
      deshabilitado={cargando || pagina === 0} onPress={() => setPagina(p => p - 1)} />
      <Texto variante="caption">Página {pagina + 1}</Texto>
      <BotonPrimario titulo="Más registros" variante="secundario" tamano="escritorio"
        deshabilitado={cargando || cantidad < 20} onPress={() => setPagina(p => p + 1)} /></View>
  </Tarjeta>;
}
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return <View style={{ gap: 4 }}><Texto variante="caption">{etiqueta}</Texto><Texto variante="cuerpoFuerte">{valor || 'Sin dato registrado'}</Texto></View>;
}
const s = StyleSheet.create({
  raiz: { gap: 24 }, fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' },
  entre: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
  cabecera: { padding: 24, gap: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.linea, borderRadius: 16 },
  avatar: { width: 56, height: 56, borderRadius: 14, backgroundColor: colores.marcaSuave, alignItems: 'center', justifyContent: 'center' },
  zona: { padding: 16, borderRadius: 12, backgroundColor: colores.fondo, flexDirection: 'row', gap: 12, alignItems: 'center' },
  evento: { padding: 20, borderRadius: 12, borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.fondo, gap: 10 },
});

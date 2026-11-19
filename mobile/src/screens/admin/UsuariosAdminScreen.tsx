import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CambioUsuarioAdmin, DetalleUsuarioAdmin, EditarUsuarioAdmin, FiltrosUsuarios, PaginaUsuarios, FilaUsuarioAdmin } from '../../domain/models/Admin';
import { adminRepository as repo } from '../../infrastructure/di';
import { useSesion } from '../../session/SesionProvider';
import { colores } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { TablaAdmin } from '../../ui/admin/TablaAdmin';
import { InvitarUsuarioAdmin } from './InvitarUsuarioAdmin';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { leerRutaAdmin, guardarRutaAdmin } from '../../infrastructure/navigation/rutaAdmin';

const ROLES = [['todos', 'Todos'], ['cliente', 'Clientes'], ['tecnico', 'Técnicos'], ['administrador', 'Administradores']] as const;
const ESTADOS = [['todos', 'Todos'], ['activo', 'Activos'], ['inactivo', 'Inactivos']] as const;
const PERFILES = [['todos', 'Todos'], ['persona', 'Persona'], ['empresa', 'Empresa']] as const;
const rolVisible: Record<string, string> = { cliente: 'Cliente', tecnico: 'Técnico', administrador: 'Administrador' };
const accesoVisible = { password: 'Contraseña', google: 'Google', google_y_password: 'Google y contraseña' };
const camposVisibles: Record<string, string> = { nombre: 'Nombre', apellido: 'Apellido', telefono: 'Teléfono',
  razonSocial: 'Razón social', nit: 'NIT', activo: 'Cuenta activa' };
const iniciales: FiltrosUsuarios = { busqueda: '', rol: 'todos', perfil: 'todos', estado: 'todos', pagina: 0, tamano: 20 };
const errorTexto = (e: unknown) => e instanceof Error ? e.message : 'No pudimos completar la operación.';
const fecha = (s: string) => new Date(s).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
const valorCambio = (v: string | boolean | null | undefined) => typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v || 'Sin dato';
function formulario(d: DetalleUsuarioAdmin): EditarUsuarioAdmin {
  return { revision: d.revision, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono ?? '',
    razonSocial: d.razonSocial ?? '', nit: d.nit ?? '', motivo: '' };
}

/** W48: lectura paginada real y ficha administrativa, sin editar identidades ni roles. */
export function UsuariosAdminScreen() {
  const { ancho } = useResponsive();
  const [filtros, setFiltros] = useState(iniciales);
  const [texto, setTexto] = useState('');
  const [datos, setDatos] = useState<PaginaUsuarios | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [id, setId] = useState<number | null>(() => leerRutaAdmin().usuario);
  const [invitando, setInvitando] = useState(false);
  const peticion = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setFiltros(f => ({ ...f, busqueda: texto, pagina: 0 })), 350);
    return () => clearTimeout(timer);
  }, [texto]);
  useEffect(() => {
    const actual = ++peticion.current;
    setCargando(true); setError('');
    repo.paginaUsuarios(filtros).then(d => { if (actual === peticion.current) setDatos(d); })
      .catch(e => { if (actual === peticion.current) setError(errorTexto(e)); })
      .finally(() => { if (actual === peticion.current) setCargando(false); });
    return () => { peticion.current++; };
  }, [filtros, recarga]);

  function filtrar(campo: 'rol' | 'estado' | 'perfil', valor: string) {
    setFiltros(f => ({ ...f, [campo]: valor, pagina: 0 }));
  }
  function abrir(id: number | null) { guardarRutaAdmin('usuarios', id); setId(id); }
  if (id !== null) return <FichaUsuario key={id} id={id} onVolver={() => abrir(null)}
    onGuardado={() => setRecarga(n => n + 1)} />;
  if (invitando) return <InvitarUsuarioAdmin onVolver={() => setInvitando(false)} />;
  return <View style={s.raiz}>
    <View style={s.miga}><Ionicons name="people-outline" size={16} color={colores.marca} />
      <Texto variante="caption">Personas / Gestión de usuarios</Texto></View>
    <Encabezado titulo="Usuarios" subtitulo="Consultá las cuentas y gestioná sus datos y acceso desde un solo lugar."
      derecha={<BotonPrimario titulo="Invitar usuario" tamano="escritorio" onPress={() => setInvitando(true)} />} />
    <View style={s.resumenLista}>
      <View style={s.icono}><Ionicons name="people-outline" size={24} color={colores.marca} /></View>
      <View style={{ gap: 2 }}><Texto variante="subtitulo">{datos?.total ?? '—'} {datos?.total === 1 ? 'cuenta encontrada' : 'cuentas encontradas'}</Texto>
        <Texto variante="caption">Según los filtros actuales · sin cuentas eliminadas</Texto></View>
      <View style={{ flex: 1 }} />
      <Chip texto="Acceso administrativo" tono="marca" />
    </View>
    <Tarjeta style={{ gap: 20 }} relleno={20}>
      <CampoTexto etiqueta="Buscar usuarios" placeholder="Nombre, razón social, correo o ID"
        value={texto} onChangeText={setTexto} autoCapitalize="none" maxLength={150} />
      <View style={s.filtros}>
        <FiltroAdmin etiqueta="Rol" valor={filtros.rol} opciones={ROLES} onChange={v => filtrar('rol', v)} />
        <FiltroAdmin etiqueta="Estado" valor={filtros.estado} opciones={ESTADOS} onChange={v => filtrar('estado', v)} />
        <FiltroAdmin etiqueta="Perfil" valor={filtros.perfil} opciones={PERFILES} onChange={v => filtrar('perfil', v)} />
      </View>
      <View style={s.acciones}>
        <Texto variante="caption" style={{ flex: 1, minWidth: 180 }}>Más recientes primero. La búsqueda se aplica automáticamente.</Texto>
        <View style={{ flexDirection: 'row', gap: 8 }}>
        <BotonPrimario titulo="Actualizar usuarios" variante="secundario" tamano="escritorio"
          deshabilitado={cargando} onPress={() => setRecarga(n => n + 1)} />
        <BotonPrimario titulo="Limpiar filtros" variante="secundario" tamano="escritorio"
          onPress={() => { setTexto(''); setFiltros(iniciales); }} />
        </View>
      </View>
    </Tarjeta>
    {error ? <Aviso tono="peligro" titulo="No pudimos actualizar el listado">{error} Usá Actualizar para reintentar.</Aviso> : null}
    {cargando ? <View style={s.miga}><ActivityIndicator color={colores.marca} /><Texto variante="caption">Cargando cuentas…</Texto></View> : null}
    {!error && datos ? <TablaAdmin filas={datos.elementos} clave={u => String(u.id)} anchoMinimo={ancho >= 1200 ? 880 : 700}
      pagina={datos.pagina} tamano={datos.tamano} total={datos.total} ocupado={cargando}
      onPagina={pagina => setFiltros(f => ({ ...f, pagina }))}
      columnas={[
        { clave: 'usuario', titulo: 'USUARIO', render: u => <View style={s.identidad}>
          <View style={s.avatar}><Texto variante="etiqueta" color={colores.marca}>{u.nombre.split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()}</Texto></View>
          <View style={{ flex: 1, gap: 4 }}><Texto variante="etiqueta" numberOfLines={1}>{u.nombre}</Texto>
            <Texto variante="caption" numberOfLines={1}>{u.email}</Texto></View>
        </View> },
        { clave: 'rol', titulo: 'ROL / PERFIL', ancho: 150, render: u => <View style={{ gap: 4 }}>
          <Texto variante="etiqueta">{rolVisible[u.rol]}</Texto>
          <Texto variante="caption">{u.tipoCliente === 'empresa' ? 'Empresa' : 'Persona'}</Texto></View> },
        { clave: 'estado', titulo: 'ESTADO', ancho: 110, render: u => <Chip texto={u.activo ? 'Activo' : 'Inactivo'} tono={u.activo ? 'exito' : 'neutro'} /> },
        ...(ancho >= 1200 ? [{ clave: 'registro', titulo: 'REGISTRO', ancho: 140, render: (u: FilaUsuarioAdmin) => <Texto variante="caption">{new Date(u.creadoEn).toLocaleDateString('es-BO')}</Texto> }] : []),
        { clave: 'accion', titulo: 'ACCIÓN', ancho: 160, render: u => <BotonPrimario titulo="Ver ficha"
          etiquetaAccesible={`Ver ficha de ${u.nombre}`}
          variante="secundario" tamano="escritorio" deshabilitado={cargando} onPress={() => abrir(u.id)} /> },
      ]} /> : null}
  </View>;
}

function FichaUsuario({ id, onVolver, onGuardado }: { id: number; onVolver: () => void; onGuardado: () => void }) {
  const { usuario } = useSesion();
  const { ancho } = useResponsive();
  const [detalle, setDetalle] = useState<DetalleUsuarioAdmin | null>(null);
  const [form, setForm] = useState<EditarUsuarioAdmin | null>(null);
  const [vista, setVista] = useState('informacion');
  const [editando, setEditando] = useState(false);
  const [accionEstado, setAccionEstado] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [historial, setHistorial] = useState<CambioUsuarioAdmin[]>([]);
  const [paginaHistoria, setPaginaHistoria] = useState(0);
  const [errorHistoria, setErrorHistoria] = useState('');
  const [cargandoHistoria, setCargandoHistoria] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [salida, setSalida] = useState<'volver' | 'recargar' | null>(null);
  const bloqueo = useRef(false);
  const sucio = !!detalle && !!form && (JSON.stringify(form) !== JSON.stringify(formulario(detalle)) || motivo !== '');
  useCambiosSinGuardar(sucio, ocupado);
  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { const d = await repo.usuario(id); setDetalle(d); setForm(formulario(d)); setEditando(false); setAccionEstado(false); setMotivo(''); }
    catch (e) { setError(errorTexto(e)); }
    finally { setCargando(false); }
  }, [id]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    if (vista !== 'historial') return;
    let vigente = true; setCargandoHistoria(true); setErrorHistoria('');
    repo.historialUsuario(id, paginaHistoria).then(h => { if (vigente) setHistorial(h); })
      .catch(e => { if (vigente) setErrorHistoria(errorTexto(e)); })
      .finally(() => { if (vigente) setCargandoHistoria(false); });
    return () => { vigente = false; };
  }, [vista, id, paginaHistoria, detalle?.revision]);

  function volver() { if (sucio) setSalida('volver'); else onVolver(); }
  function cancelar() {
    setForm(formulario(detalle!)); setEditando(false); setAccionEstado(false); setMotivo('');
    setErrores({}); setError(''); setSalida(null);
  }
  function cambiar(k: keyof EditarUsuarioAdmin, v: string) {
    setForm(f => f ? { ...f, [k]: v } : null); setErrores(e => ({ ...e, [k]: '' }));
  }
  async function guardar(estado = false) {
    if (!detalle || !form || bloqueo.current) return;
    const e: Record<string, string> = {};
    if (estado) { if (motivo.trim().length < 5) e.estado = 'Escribí un motivo de al menos 5 caracteres.'; }
    else {
      if (form.nombre.trim().length < 2) e.nombre = 'Ingresá al menos 2 caracteres.';
      if (form.apellido.trim().length < 2) e.apellido = 'Ingresá al menos 2 caracteres.';
      if (form.motivo.trim().length < 5) e.motivo = 'Explicá el cambio en al menos 5 caracteres.';
      if (detalle.tipoCliente === 'empresa') {
        if (form.razonSocial.trim().length < 2) e.razonSocial = 'Completá la razón social.';
        if (!/^\d{5,20}$/.test(form.nit)) e.nit = 'Ingresá entre 5 y 20 dígitos.';
      }
    }
    setErrores(e); if (Object.keys(e).length) return;
    bloqueo.current = true; setOcupado(true); setError(''); setMensaje('');
    try {
      const d = estado ? await repo.estadoUsuario(id, { revision: detalle.revision, activo: !detalle.activo, motivo })
        : await repo.editarUsuario(id, form);
      setDetalle(d); setForm(formulario(d)); setEditando(false); setAccionEstado(false); setMotivo('');
      setMensaje(estado ? `Cuenta ${d.activo ? 'reactivada' : 'desactivada'}. La acción quedó registrada.` : 'Datos guardados. El cambio quedó registrado en el historial.');
      onGuardado();
    } catch (e) { setError(errorTexto(e)); }
    finally { setOcupado(false); bloqueo.current = false; }
  }
  return <View style={s.raiz}>
    <View style={s.acciones}>
      <BotonPrimario titulo="Volver a Usuarios" variante="secundario" tamano="escritorio" deshabilitado={ocupado} onPress={volver} />
      <Texto variante="caption">Personas / Usuarios / Ficha #{id}</Texto>
    </View>
    {salida ? <Aviso tono="advertencia" titulo="Tenés cambios sin guardar">
      Volvé al formulario para conservarlos o descartalos para salir.
    </Aviso> : null}
    {salida ? <View style={s.filtros}><BotonPrimario titulo="Seguir editando" tamano="escritorio" onPress={() => setSalida(null)} />
      <BotonPrimario titulo={salida === 'recargar' ? 'Descartar y recargar' : 'Descartar y volver'} tamano="escritorio" variante="secundario"
        onPress={() => { if (salida === 'recargar') { setSalida(null); void cargar(); } else onVolver(); }} /></View> : null}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
    {cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {!detalle && !cargando ? <BotonPrimario titulo="Reintentar" onPress={() => void cargar()} /> : null}
    {detalle && form ? <>
      <View style={s.resumen}>
        <View style={[s.avatar, { width: 56, height: 56 }]}><Ionicons name={detalle.tipoCliente === 'empresa' ? 'business-outline' : 'person-outline'} size={28} color={colores.marca} /></View>
        <View style={{ flex: 1, gap: 6 }}><Texto variante="titulo">{detalle.razonSocial || `${detalle.nombre} ${detalle.apellido}`}</Texto>
          <Texto color={colores.secundario}>{detalle.email}</Texto>
          <View style={s.filtros}><Chip texto={rolVisible[detalle.rol]} tono="marca" />
            <Chip texto={detalle.activo ? 'Cuenta activa' : 'Cuenta inactiva'} tono={detalle.activo ? 'exito' : 'neutro'} />
            {detalle.rol === 'tecnico' ? <Chip texto={`Validación técnica: ${detalle.estadoValidacion ?? 'sin expediente'}`} /> : null}</View>
        </View>
        {!editando && !accionEstado ? <BotonPrimario titulo="Editar datos" tamano="escritorio"
          deshabilitado={cargando} onPress={() => { setEditando(true); setVista('informacion'); setMensaje(''); }} /> : null}
      </View>
      <FiltroAdmin etiqueta="Ficha de usuario" valor={vista} opciones={[['informacion', 'Información'], ['historial', 'Historial administrativo']]}
        deshabilitado={editando || accionEstado || ocupado} onChange={setVista} />
      {vista === 'informacion' ? <View style={[s.detalleColumnas, ancho >= 1360 && { flexDirection: 'row' }]}>
        <Tarjeta style={{ flex: 2, minWidth: 0, gap: 20 }}>
          <Texto variante="subtitulo">{editando ? 'Editar información' : 'Información de la cuenta'}</Texto>
          {editando ? <>
            {detalle.rol === 'tecnico' && detalle.estadoValidacion === 'aprobado' ?
              <Aviso>El nombre de un técnico aprobado requiere revisión documental y no se modifica desde esta ficha.</Aviso> : null}
            <CampoTexto etiqueta="Nombre" value={form.nombre} onChangeText={v => cambiar('nombre', v)} maxLength={100}
              error={errores.nombre} editable={!ocupado && !(detalle.rol === 'tecnico' && detalle.estadoValidacion === 'aprobado')} autoFocus />
            <CampoTexto etiqueta="Apellido" value={form.apellido} onChangeText={v => cambiar('apellido', v)} maxLength={100}
              error={errores.apellido} editable={!ocupado && !(detalle.rol === 'tecnico' && detalle.estadoValidacion === 'aprobado')} />
            <CampoTexto etiqueta="Teléfono" value={form.telefono} onChangeText={v => cambiar('telefono', v)} maxLength={20} editable={!ocupado} />
            {detalle.tipoCliente === 'empresa' ? <>
              <CampoTexto etiqueta="Razón social" value={form.razonSocial} onChangeText={v => cambiar('razonSocial', v)}
                error={errores.razonSocial} maxLength={150} editable={!ocupado} />
              <CampoTexto etiqueta="NIT" value={form.nit} onChangeText={v => cambiar('nit', v)}
                error={errores.nit} maxLength={20} editable={!ocupado} />
            </> : null}
            <CampoTexto etiqueta="Motivo de la edición" value={form.motivo} onChangeText={v => cambiar('motivo', v)}
              error={errores.motivo} placeholder="Explicá por qué se actualizan los datos" multiline maxLength={500} editable={!ocupado} />
            <View style={s.filtros}><BotonPrimario titulo="Guardar cambios" tamano="escritorio" cargando={ocupado} onPress={() => void guardar()} />
              <BotonPrimario titulo="Cancelar edición" tamano="escritorio" variante="secundario" deshabilitado={ocupado} onPress={cancelar} /></View>
          </> : <>
            <Dato etiqueta="Nombre y apellido" valor={`${detalle.nombre} ${detalle.apellido}`} />
            <Dato etiqueta="Teléfono" valor={detalle.telefono} />
            {detalle.tipoCliente === 'empresa' ? <><Dato etiqueta="Razón social" valor={detalle.razonSocial} /><Dato etiqueta="NIT" valor={detalle.nit} /></> : null}
            <Dato etiqueta="Fecha de registro" valor={fecha(detalle.creadoEn)} />
            <Dato etiqueta="Tipo de perfil" valor={detalle.tipoCliente === 'empresa' ? 'Empresa' : 'Persona'} />
          </>}
        </Tarjeta>
        <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
          <Tarjeta style={{ gap: 16 }}><Texto variante="subtitulo">Acceso y seguridad</Texto>
            <Dato etiqueta="Método de acceso" valor={accesoVisible[detalle.acceso]} />
            <Dato etiqueta="Correo de la cuenta" valor={detalle.email} />
            <Texto variante="caption">El correo, el rol y el método de acceso no se cambian en este formulario. Nunca se muestran contraseñas ni documentos privados.</Texto>
          </Tarjeta>
          <Tarjeta style={{ gap: 16 }}>
            <Texto variante="subtitulo">Estado de la cuenta</Texto>
            <Texto color={colores.secundario}>{detalle.activo ? 'Desactivar impide nuevos accesos e invalida las sesiones existentes. No elimina datos ni decisiones técnicas.' :
              'Reactivar permite iniciar una sesión nueva. No recupera sesiones anteriores ni aprueba al técnico.'}</Texto>
            {usuario?.id === detalle.id ? <Aviso>No podés desactivar tu propia cuenta.</Aviso> :
              !editando && !accionEstado ? <BotonPrimario titulo={detalle.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}
                variante="secundario" tamano="escritorio" onPress={() => { setAccionEstado(true); setMensaje(''); setError(''); }} /> : null}
            {accionEstado ? <>
              <Aviso tono={detalle.activo ? 'advertencia' : 'info'} titulo="Confirmá el cambio">
                {detalle.activo ? 'La cuenta dejará de acceder a Fixly. Si tiene órdenes en curso, la operación será rechazada.' :
                  'La cuenta podrá iniciar sesión nuevamente. Sus permisos y su validación técnica no cambian.'}
              </Aviso>
              <CampoTexto etiqueta="Motivo del cambio de estado" value={motivo} onChangeText={setMotivo}
                error={errores.estado} maxLength={500} editable={!ocupado} multiline autoFocus />
              <BotonPrimario titulo={detalle.activo ? 'Confirmar desactivación' : 'Confirmar reactivación'}
                tamano="escritorio" cargando={ocupado} onPress={() => void guardar(true)} />
              <BotonPrimario titulo="Cancelar cambio" tamano="escritorio" variante="secundario" deshabilitado={ocupado} onPress={cancelar} />
            </> : null}
          </Tarjeta>
        </View>
      </View> : <Tarjeta style={{ gap: 20 }}>
        <Texto variante="subtitulo">Historial administrativo</Texto>
        <Texto variante="caption">Cambios realizados desde este módulo. No se reconstruyen acciones anteriores a su implementación.</Texto>
        {cargandoHistoria ? <ActivityIndicator color={colores.marca} /> : errorHistoria ? <Aviso tono="peligro">{errorHistoria}</Aviso> : <>
          {!historial.length ? <Aviso>No hay cambios administrativos en esta página.</Aviso> : null}
          {historial.map(c => <View key={c.id} style={s.evento}>
            <View style={s.acciones}><Texto variante="etiqueta">{({ crear: 'Cuenta creada por invitación', editar: 'Datos actualizados', desactivar: 'Cuenta desactivada', reactivar: 'Cuenta reactivada' } as Record<string, string>)[c.accion] ?? c.accion}</Texto>
              <Texto variante="caption">{fecha(c.creadoEn)}</Texto></View>
            <Texto variante="caption">Por {c.administrador}</Texto><Texto>{c.motivo}</Texto>
            {Object.keys(c.despues).filter(k => c.antes[k] !== c.despues[k]).map(k => <Texto key={k} variante="caption">
              {camposVisibles[k] ?? k}: {valorCambio(c.antes[k])} → {valorCambio(c.despues[k])}
            </Texto>)}
          </View>)}
        </>}
        <View style={s.filtros}><BotonPrimario titulo="Anteriores" tamano="escritorio" variante="secundario"
          deshabilitado={cargandoHistoria || paginaHistoria === 0} onPress={() => setPaginaHistoria(p => p - 1)} />
          <Texto variante="caption">Página {paginaHistoria + 1}</Texto>
          <BotonPrimario titulo="Más cambios" tamano="escritorio" variante="secundario"
            deshabilitado={cargandoHistoria || historial.length < 20} onPress={() => setPaginaHistoria(p => p + 1)} /></View>
      </Tarjeta>}
      {error && !ocupado ? <BotonPrimario titulo="Recargar detalle" variante="secundario" tamano="escritorio"
        onPress={() => { if (!sucio) void cargar(); else setSalida('recargar'); }} /> : null}
    </> : null}
  </View>;
}
function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  return <View style={{ gap: 4 }}><Texto variante="caption">{etiqueta}</Texto><Texto variante="cuerpoFuerte">{valor || 'Sin dato'}</Texto></View>;
}
const s = StyleSheet.create({
  raiz: { gap: 24 }, miga: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: 24,
    borderWidth: 1, borderColor: colores.linea, backgroundColor: colores.superficie, borderRadius: 16 },
  resumenLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  icono: { padding: 14, borderRadius: 14, backgroundColor: colores.marcaSuave },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: colores.marcaSuave, alignItems: 'center', justifyContent: 'center' },
  detalleColumnas: { gap: 24, alignItems: 'stretch' },
  evento: { padding: 20, gap: 8, borderWidth: 1, borderColor: colores.linea, borderRadius: 12, backgroundColor: colores.fondo },
});

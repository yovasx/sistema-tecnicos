import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditarPerfil, PerfilPropio } from '../../domain/models/Perfil';
import { perfilRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';
import { useSesion } from '../../session/SesionProvider';
import { useResponsive } from '../../theme/responsive';
import { colores } from '../../theme/tokens';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip } from '../../ui/Chip';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { VincularGoogle } from '../auth/VincularGoogle';
import { FotoPerfil } from './FotoPerfil';
import { DireccionesCliente } from './DireccionesCliente';
import { ReputacionPropia } from './ReputacionPropia';
import { ConfiguracionHogar } from './ConfiguracionHogar';

const accesoVisible = { password: 'Contraseña Fixly', google: 'Google', google_y_password: 'Google y contraseña Fixly' };
const rolVisible = { cliente: 'Cliente', tecnico: 'Técnico', administrador: 'Administrador' };
const errorTexto = (e: unknown) => e instanceof Error ? e.message : 'No pudimos completar la operación.';
const fila = { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as const;

/** Datos propios, no un CRUD administrativo ni una edición del expediente técnico. */
export function MiCuentaScreen() {
  const { usuario, cerrarSesion } = useSesion();
  const { esDesktop } = useResponsive();
  const [cuenta, setCuenta] = useState<PerfilPropio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [vista, setVista] = useState<'consulta' | 'datos' | 'password'>('consulta');
  const [vinculando, setVinculando] = useState(false);
  const [editandoDireccion, setEditandoDireccion] = useState(false);
  const [cambiandoFoto, setCambiandoFoto] = useState(false);
  const interaccionSecundaria = vinculando || editandoDireccion || cambiandoFoto;
  useCambiosSinGuardar(false, cambiandoFoto);
  const peticion = useRef(0);
  const cargar = useCallback(async () => {
    const turno = ++peticion.current;
    setCargando(true); setError('');
    try {
      const d = await perfilRepository.propio();
      if (turno === peticion.current && d.id === usuario?.id) setCuenta(d);
    } catch (e) { if (turno === peticion.current) setError(errorTexto(e)); }
    finally { if (turno === peticion.current) setCargando(false); }
  }, [usuario?.id]);
  useEffect(() => { void cargar(); return () => { peticion.current++; }; }, [cargar]);

  const contenido = <View style={{ gap: 24, width: '100%', maxWidth: 960 }}>
    <Encabezado titulo="Mi cuenta" subtitulo="Tu información personal y las opciones de acceso a Fixly."
      derecha={vista === 'consulta' ? <BotonPrimario titulo="Actualizar perfil" variante="secundario"
        tamano="escritorio" deshabilitado={cargando || interaccionSecundaria} onPress={() => void cargar()} /> : undefined} />
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
    {editandoDireccion ? <Aviso>Guarda o cancela la dirección antes de editar otra sección de tu cuenta.</Aviso> : null}
    {cargando ? <ActivityIndicator color={colores.marca} /> : cuenta && cuenta.id === usuario?.id ? <>
      <Tarjeta style={{ gap: 16 }}>
        <View style={fila}><Chip texto={rolVisible[cuenta.rol]} tono="marca" />
          {cuenta.tipoCliente === 'empresa' ? <Chip texto="Empresa" /> : null}
          <Chip texto="Tu cuenta" /></View>
        {vista === 'consulta' && !vinculando && !editandoDireccion && cuenta.rol !== 'administrador'
          ? <FotoPerfil cuenta={cuenta} onCambio={setCuenta} onInteraccion={setCambiandoFoto} /> : null}
        <Texto variante="titulo">{cuenta.razonSocial || `${cuenta.nombre} ${cuenta.apellido}`}</Texto>
        <Texto color={colores.secundario}>{cuenta.email}</Texto>
        <Texto variante="caption">El correo, el rol y el tipo de cuenta no se cambian desde este apartado.</Texto>
      </Tarjeta>
      {vista === 'datos' ? <FormularioDatos key={cuenta.revision} cuenta={cuenta}
        onCancelar={() => setVista('consulta')}
        onGuardado={(d, m) => { setCuenta(d); setVista('consulta'); setMensaje(m); }} /> :
        vista === 'password' ? <FormularioPassword onCancelar={() => setVista('consulta')} /> : <>
          <Tarjeta style={{ gap: 16 }}>
            <Texto variante="subtitulo">Datos personales</Texto>
            <Dato etiqueta="Nombre y apellido" valor={`${cuenta.nombre} ${cuenta.apellido}`} />
            <Dato etiqueta="Teléfono" valor={cuenta.telefono} />
            {cuenta.tipoCliente === 'empresa' ? <>
              <Dato etiqueta="Razón social" valor={cuenta.razonSocial} /><Dato etiqueta="NIT" valor={cuenta.nit} />
            </> : null}
            <BotonPrimario titulo="Editar mi información" tamano="escritorio"
              deshabilitado={interaccionSecundaria}
              onPress={() => { setMensaje(''); setVista('datos'); }} />
          </Tarjeta>
          <Tarjeta style={{ gap: 16 }}>
            <Texto variante="subtitulo">Acceso y seguridad</Texto>
            <Dato etiqueta="Método de acceso" valor={accesoVisible[cuenta.acceso]} />
            {cuenta.acceso === 'google' ? <Aviso titulo="Ingresas con Google">
              Para volver a entrar, selecciona Continuar con Google y la misma cuenta. No tienes una contraseña Fixly;
              la seguridad de tu contraseña Google se administra desde Google.
            </Aviso> : <>
              <Texto variante="caption">Cambiar tu contraseña cerrará todas tus sesiones. Después, ingresa con la nueva contraseña.</Texto>
              <BotonPrimario titulo="Cambiar contraseña" variante="secundario" tamano="escritorio"
                deshabilitado={interaccionSecundaria}
                onPress={() => { setMensaje(''); setVista('password'); }} />
            </>}
            {!editandoDireccion && !cambiandoFoto && cuenta.acceso === 'password' && (cuenta.rol === 'tecnico' || (cuenta.rol === 'cliente' && cuenta.tipoCliente === 'persona')) ?
              <VincularGoogle onInteraccion={setVinculando} onVinculado={() => { void cargar(); }} /> : null}
          </Tarjeta>
          {cuenta.rol === 'cliente' && cuenta.tipoCliente === 'persona' && !vinculando && !cambiandoFoto ? <>
            <DireccionesCliente onEdicion={setEditandoDireccion} />
            {!editandoDireccion ? <ConfiguracionHogar /> : null}
            <ReputacionPropia />
          </> : null}
          {cuenta.rol === 'tecnico' && !vinculando && !cambiandoFoto ? <ReputacionPropia /> : null}
          {cuenta.rol === 'tecnico' ? <Tarjeta style={{ gap: 16 }}>
            <Texto variante="subtitulo">Perfil profesional</Texto>
            <Dato etiqueta="Validación documental" valor={cuenta.estadoValidacion || 'Sin expediente registrado'} />
            <Dato etiqueta="Especialidades registradas" valor={cuenta.especialidades.join(', ') || 'Sin especialidades registradas'} />
            <Texto variante="caption">La aprobación, los documentos y la cobertura no se modifican con la edición de datos personales.</Texto>
          </Tarjeta> : null}
          {!esDesktop ? <BotonPrimario titulo="Cerrar sesión" variante="secundario" deshabilitado={interaccionSecundaria}
            onPress={() => void cerrarSesion()} /> : null}
        </>}
    </> : !cargando ? <BotonPrimario titulo="Reintentar perfil" onPress={() => void cargar()} /> : null}
  </View>;
  if (esDesktop) return contenido;
  return <ContenedorApp><SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
      {contenido}
    </ScrollView>
  </SafeAreaView></ContenedorApp>;
}

function FormularioDatos({ cuenta, onCancelar, onGuardado }: {
  cuenta: PerfilPropio; onCancelar: () => void; onGuardado: (d: PerfilPropio, mensaje: string) => void;
}) {
  const { refrescarUsuario } = useSesion();
  const inicial: EditarPerfil = { revision: cuenta.revision, nombre: cuenta.nombre, apellido: cuenta.apellido,
    telefono: cuenta.telefono ?? '', razonSocial: cuenta.razonSocial ?? '', nit: cuenta.nit ?? '' };
  const [form, setForm] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [conflicto, setConflicto] = useState(false);
  const [salida, setSalida] = useState(false);
  const bloqueo = useRef(false);
  const sucio = JSON.stringify(form) !== JSON.stringify(inicial);
  const protegida = cuenta.rol === 'tecnico' && cuenta.estadoValidacion === 'aprobado';
  useCambiosSinGuardar(sucio, ocupado);
  function cambiar(k: keyof EditarPerfil, valor: string) {
    setForm(f => ({ ...f, [k]: valor })); setErrores(e => ({ ...e, [k]: '' }));
  }
  async function guardar() {
    if (bloqueo.current || conflicto) return;
    const e: Record<string, string> = {};
    if (form.nombre.trim().length < 2) e.nombre = 'Ingresa al menos 2 caracteres.';
    if (form.apellido.trim().length < 2) e.apellido = 'Ingresa al menos 2 caracteres.';
    if (cuenta.tipoCliente === 'empresa') {
      if (form.razonSocial.trim().length < 2) e.razonSocial = 'Completa la razón social.';
      if (!/^\d{5,20}$/.test(form.nit.trim())) e.nit = 'Ingresa entre 5 y 20 dígitos.';
    }
    setErrores(e); if (Object.keys(e).length) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      const d = await perfilRepository.editar(form);
      const sincronizada = await refrescarUsuario();
      onGuardado(d, sincronizada ? 'Tu información se guardó correctamente.' :
        'Información guardada. No pudimos actualizar el encabezado; recarga para verlo actualizado.');
    } catch (e) {
      setError(errorTexto(e));
      if (e instanceof ErrorApi) {
        setConflicto(e.codigo === 'CAMBIO_CONCURRENTE');
        setErrores(Object.fromEntries(e.campos.map(c => [c.campo, c.mensaje])));
      }
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 16 }}>
    <Texto variante="subtitulo">Editar mis datos</Texto>
    {protegida ? <Aviso>Tu nombre y apellido aprobados requieren revisión documental. Puedes actualizar el teléfono sin cambiar tu aprobación.</Aviso> : null}
    <CampoTexto etiqueta="Nombre" value={form.nombre} onChangeText={v => cambiar('nombre', v)}
      maxLength={100} error={errores.nombre} editable={!ocupado && !protegida} />
    <CampoTexto etiqueta="Apellido" value={form.apellido} onChangeText={v => cambiar('apellido', v)}
      maxLength={100} error={errores.apellido} editable={!ocupado && !protegida} />
    <CampoTexto etiqueta="Teléfono" value={form.telefono} onChangeText={v => cambiar('telefono', v)}
      maxLength={20} keyboardType="phone-pad" error={errores.telefono} editable={!ocupado} />
    {cuenta.tipoCliente === 'empresa' ? <>
      <CampoTexto etiqueta="Razón social" value={form.razonSocial} onChangeText={v => cambiar('razonSocial', v)}
        maxLength={150} error={errores.razonSocial} editable={!ocupado} />
      <CampoTexto etiqueta="NIT" value={form.nit} onChangeText={v => cambiar('nit', v)}
        maxLength={20} keyboardType="number-pad" error={errores.nit} editable={!ocupado} />
    </> : null}
    {error ? <Aviso tono="peligro">{error}{conflicto ? ' Cancela la edición y actualiza el perfil. Tu borrador se conserva hasta que lo descartes.' : ''}</Aviso> : null}
    {salida ? <Aviso tono="advertencia">Tienes cambios sin guardar. Confirma si quieres descartarlos.</Aviso> : null}
    <View style={fila}>
      <BotonPrimario titulo="Guardar cambios" cargando={ocupado} deshabilitado={!sucio || conflicto} onPress={() => void guardar()} />
      <BotonPrimario titulo={salida ? 'Descartar edición' : 'Cancelar edición'} variante="secundario" deshabilitado={ocupado}
        onPress={() => sucio && !salida ? setSalida(true) : onCancelar()} />
      {salida ? <BotonPrimario titulo="Seguir editando" variante="secundario" onPress={() => setSalida(false)} /> : null}
    </View>
  </Tarjeta>;
}

export function FormularioPassword({ onCancelar }: { onCancelar: () => void }) {
  const { cerrarSesion } = useSesion();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [salida, setSalida] = useState(false);
  const bloqueo = useRef(false);
  const sucio = !!(actual || nueva || confirmacion);
  useCambiosSinGuardar(sucio, ocupado);
  async function guardar() {
    if (bloqueo.current) return;
    const e: Record<string, string> = {};
    if (!actual) e.actual = 'Ingresa tu contraseña actual.';
    if (nueva.length < 8 || nueva.length > 72) e.nueva = 'Usa entre 8 y 72 caracteres.';
    if (actual === nueva) e.nueva = 'Selecciona una contraseña diferente.';
    if (nueva !== confirmacion) e.confirmacion = 'Las contraseñas no coinciden.';
    setErrores(e); if (Object.keys(e).length) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      await perfilRepository.cambiarPassword(actual, nueva);
      setActual(''); setNueva(''); setConfirmacion('');
      await cerrarSesion();
    } catch (e) {
      setError(errorTexto(e));
      if (e instanceof ErrorApi && e.codigo === 'PASSWORD_ACTUAL_INVALIDA')
        setErrores({ actual: e.message });
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 16 }}>
    <Texto variante="subtitulo">Cambiar contraseña Fixly</Texto>
    <Aviso tono="advertencia">Al confirmar se cerrarán todas tus sesiones, incluida esta. Vuelve a ingresar con tu nueva contraseña.</Aviso>
    <CampoTexto etiqueta="Contraseña actual" value={actual} onChangeText={setActual} esPassword
      autoComplete="current-password" maxLength={72} editable={!ocupado} error={errores.actual} />
    <CampoTexto etiqueta="Nueva contraseña" value={nueva} onChangeText={setNueva} esPassword
      autoComplete="new-password" maxLength={72} editable={!ocupado} error={errores.nueva} />
    <CampoTexto etiqueta="Repetir nueva contraseña" value={confirmacion} onChangeText={setConfirmacion} esPassword
      autoComplete="new-password" maxLength={72} editable={!ocupado} error={errores.confirmacion} />
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {salida ? <Aviso tono="advertencia">Confirma si quieres descartar los datos ingresados.</Aviso> : null}
    <View style={fila}>
      <BotonPrimario titulo="Confirmar cambio y cerrar sesiones" cargando={ocupado} onPress={() => void guardar()} />
      <BotonPrimario titulo={salida ? 'Descartar cambio' : 'Cancelar cambio'} variante="secundario" deshabilitado={ocupado}
        onPress={() => sucio && !salida ? setSalida(true) : onCancelar()} />
      {salida ? <BotonPrimario titulo="Seguir editando" variante="secundario" onPress={() => setSalida(false)} /> : null}
    </View>
  </Tarjeta>;
}
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return <View style={{ gap: 4 }}><Texto variante="caption">{etiqueta}</Texto><Texto>{valor || 'Sin dato registrado'}</Texto></View>;
}

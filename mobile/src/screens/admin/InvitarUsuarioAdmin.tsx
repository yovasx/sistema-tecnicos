import { useRef, useState } from 'react';
import { View } from 'react-native';
import { InvitacionUsuarioAdmin } from '../../domain/models/Admin';
import { adminRepository } from '../../infrastructure/di';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Tarjeta } from '../../ui/Tarjeta';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { colores } from '../../theme/tokens';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

const vacio: InvitacionUsuarioAdmin = { email: '', nombre: '', apellido: '', telefono: '', rol: 'cliente',
  tipoCliente: 'persona', razonSocial: '', nit: '', passwordAdmin: '' };
export function InvitarUsuarioAdmin({ onVolver, rolFijo }: { onVolver: () => void; rolFijo?: 'tecnico' }) {
  const inicial = { ...vacio, rol: rolFijo ?? vacio.rol };
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [confirmacion, setConfirmacion] = useState(false);
  const [salir, setSalir] = useState(false);
  const bloqueo = useRef(false);
  const sucio = JSON.stringify(form) !== JSON.stringify(inicial);
  useCambiosSinGuardar(sucio, ocupado);
  function cambiar(k: keyof InvitacionUsuarioAdmin, v: string) {
    setForm(f => ({ ...f, [k]: v, ...(k === 'rol' && v !== 'cliente' ? { tipoCliente: 'persona' } : {}) }));
    setConfirmacion(false);
  }
  async function enviar() {
    if (bloqueo.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.nombre.trim().length < 2 ||
        form.apellido.trim().length < 2 || !form.passwordAdmin ||
        (form.tipoCliente === 'empresa' && (form.razonSocial.trim().length < 2 || !/^\d{5,20}$/.test(form.nit)))) {
      setError('Completá nombre, apellido, correo válido y tu contraseña. Para empresas, ingresá razón social y NIT válido.'); return;
    }
    if (form.rol === 'administrador' && !confirmacion) { setConfirmacion(true); return; }
    bloqueo.current = true; setOcupado(true); setError('');
    try { await adminRepository.invitarUsuario({ ...form, email: form.email.trim() }); setEnviada(true); setForm(inicial); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos enviar la invitación.'); setForm(f => ({ ...f, passwordAdmin: '' })); setConfirmacion(false); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <View style={{ gap: 24, maxWidth: 860, width: '100%', alignSelf: 'center' }}>
    <BotonPrimario titulo={rolFijo ? 'Volver a Técnicos' : 'Volver a Usuarios'} variante="secundario" tamano="escritorio" deshabilitado={ocupado}
      onPress={() => sucio ? setSalir(true) : onVolver()} />
    {salir ? <><Aviso tono="advertencia">Tenés datos sin enviar. ¿Querés descartar la invitación?</Aviso>
      <BotonPrimario titulo="Descartar invitación" variante="secundario" tamano="escritorio" onPress={onVolver} />
      <BotonPrimario titulo="Continuar con la invitación" tamano="escritorio" onPress={() => setSalir(false)} /></> : null}
    <View style={{ gap: 8 }}><Texto variante="titulo">{rolFijo ? 'Invitar técnico' : 'Invitar usuario'}</Texto>
      <Texto color={colores.secundario}>Un alta segura: la persona recibe un código por correo y define su propia contraseña.</Texto></View>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {enviada ? <><Aviso tono="exito" titulo="Invitación enviada al servidor de correo">
      La cuenta aparecerá en Usuarios cuando el destinatario acepte la invitación. El código vence en 24 horas.
    </Aviso><BotonPrimario titulo="Volver al listado" onPress={onVolver} /></> : <Tarjeta style={{ gap: 20 }}>
      <Texto variante="subtitulo">Perfil y permisos</Texto>
      {!rolFijo ? <FiltroAdmin etiqueta="Rol de la cuenta" valor={form.rol} deshabilitado={ocupado}
        opciones={[['cliente', 'Cliente'], ['tecnico', 'Técnico'], ['administrador', 'Administrador']]}
        onChange={v => cambiar('rol', v)} /> : null}
      {form.rol === 'cliente' ? <FiltroAdmin etiqueta="Tipo de cliente" valor={form.tipoCliente} deshabilitado={ocupado}
        opciones={[['persona', 'Persona'], ['empresa', 'Empresa']]} onChange={v => cambiar('tipoCliente', v)} /> : null}
      {form.rol === 'tecnico' ? <Aviso>El técnico deberá completar su expediente y obtener aprobación. La invitación no lo habilita para aceptar servicios.</Aviso> : null}
      {form.rol === 'administrador' ? <Aviso tono="advertencia">Esta cuenta tendrá acceso al backoffice y a sus acciones administrativas. Verificá el correo antes de continuar.</Aviso> : null}
      <Texto variante="subtitulo">Datos del destinatario</Texto>
      <CampoTexto etiqueta="Nombre del invitado" value={form.nombre} onChangeText={v => cambiar('nombre', v)} maxLength={100} editable={!ocupado} />
      <CampoTexto etiqueta="Apellido del invitado" value={form.apellido} onChangeText={v => cambiar('apellido', v)} maxLength={100} editable={!ocupado} />
      <CampoTexto etiqueta="Correo del invitado" value={form.email} onChangeText={v => cambiar('email', v)}
        autoCapitalize="none" keyboardType="email-address" maxLength={150} editable={!ocupado} />
      <CampoTexto etiqueta="Teléfono (opcional)" value={form.telefono} onChangeText={v => cambiar('telefono', v)} maxLength={20} editable={!ocupado} />
      {form.tipoCliente === 'empresa' ? <>
        <CampoTexto etiqueta="Razón social" value={form.razonSocial} onChangeText={v => cambiar('razonSocial', v)} maxLength={150} editable={!ocupado} />
        <CampoTexto etiqueta="NIT" value={form.nit} onChangeText={v => cambiar('nit', v)} maxLength={20} editable={!ocupado} />
      </> : null}
      <Texto variante="subtitulo">Confirmá tu identidad</Texto>
      <CampoTexto etiqueta="Tu contraseña de administrador" value={form.passwordAdmin} onChangeText={v => cambiar('passwordAdmin', v)}
        esPassword autoComplete="current-password" maxLength={72} editable={!ocupado} />
      <Texto variante="caption">No es la contraseña del invitado. Se usa únicamente para autorizar esta acción y no se guarda en el historial.</Texto>
      {confirmacion ? <Aviso tono="advertencia" titulo="Confirmá el acceso administrativo">
        Vas a invitar a {form.email} como administrador. Tendrá los mismos permisos administrativos que tu cuenta.
      </Aviso> : null}
      <BotonPrimario titulo={confirmacion ? 'Confirmar invitación de administrador' : 'Enviar invitación'}
        tamano="escritorio" cargando={ocupado} onPress={() => void enviar()} />
    </Tarjeta>}
  </View>;
}

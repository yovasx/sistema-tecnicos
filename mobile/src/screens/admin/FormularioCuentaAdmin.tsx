import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { DetalleUsuarioAdmin, EditarPerfilAdmin } from '../../domain/models/Admin';
import { adminRepository } from '../../infrastructure/di';
import { useSesion } from '../../session/SesionProvider';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';

/** Edición de datos permitidos, compartida por Mi perfil y la ficha técnica. */
export function FormularioCuentaAdmin({ cuenta, propio = false, onGuardado, onCancelar, onInteraccion }: {
  cuenta: DetalleUsuarioAdmin;
  propio?: boolean;
  onGuardado: (cuenta: DetalleUsuarioAdmin, mensaje: string) => void;
  onCancelar: () => void;
  onInteraccion?: (sucio: boolean, ocupado: boolean) => void;
}) {
  const { usuario, refrescarUsuario } = useSesion();
  const inicial: EditarPerfilAdmin = { revision: cuenta.revision, nombre: cuenta.nombre,
    apellido: cuenta.apellido, telefono: cuenta.telefono ?? '', motivo: '' };
  const [form, setForm] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const bloqueo = useRef(false);
  const sucio = JSON.stringify(form) !== JSON.stringify(inicial);
  const identidadProtegida = cuenta.rol === 'tecnico' && cuenta.estadoValidacion === 'aprobado';
  useCambiosSinGuardar(sucio, ocupado);
  useEffect(() => {
    onInteraccion?.(sucio, ocupado);
    return () => onInteraccion?.(false, false);
  }, [sucio, ocupado, onInteraccion]);
  function cambiar(campo: keyof EditarPerfilAdmin, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
    setErrores(e => ({ ...e, [campo]: '' }));
  }
  async function guardar() {
    if (bloqueo.current) return;
    const errores: Record<string, string> = {};
    if (form.nombre.trim().length < 2) errores.nombre = 'Ingresá al menos 2 caracteres.';
    if (form.apellido.trim().length < 2) errores.apellido = 'Ingresá al menos 2 caracteres.';
    if (form.motivo.trim().length < 5) errores.motivo = 'Explicá el cambio en al menos 5 caracteres.';
    setErrores(errores);
    if (Object.keys(errores).length) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      const datos = { ...form, nombre: form.nombre.trim(), apellido: form.apellido.trim(),
        telefono: form.telefono.trim(), motivo: form.motivo.trim() };
      const actual = propio ? await adminRepository.editarPerfil(datos) :
        await adminRepository.editarUsuario(cuenta.id, { ...datos,
          razonSocial: cuenta.razonSocial ?? '', nit: cuenta.nit ?? '' });
      const sincronizada = usuario?.id !== actual.id || await refrescarUsuario();
      onGuardado(actual, sincronizada ? 'Datos guardados. El cambio quedó auditado.' :
        'Datos guardados. No pudimos refrescar el encabezado; recargá la página para actualizarlo.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar los datos.');
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  return <View style={{ gap: 16 }}>
    <Texto variante="subtitulo">Editar datos generales</Texto>
    {identidadProtegida ? <Aviso titulo="Identidad aprobada">
      El nombre y apellido requieren una corrección documental. Podés actualizar el teléfono
      sin modificar la aprobación, las especialidades ni la cobertura.
    </Aviso> : null}
    <CampoTexto etiqueta="Nombre" value={form.nombre} onChangeText={v => cambiar('nombre', v)}
      maxLength={100} editable={!ocupado && !identidadProtegida} error={errores.nombre} />
    <CampoTexto etiqueta="Apellido" value={form.apellido} onChangeText={v => cambiar('apellido', v)}
      maxLength={100} editable={!ocupado && !identidadProtegida} error={errores.apellido} />
    <CampoTexto etiqueta="Teléfono" value={form.telefono} onChangeText={v => cambiar('telefono', v)}
      keyboardType="phone-pad" maxLength={20} editable={!ocupado} />
    <CampoTexto etiqueta="Motivo de la edición" value={form.motivo} onChangeText={v => cambiar('motivo', v)}
      multiline maxLength={500} editable={!ocupado} error={errores.motivo} />
    <Texto variante="caption">El correo y el rol se conservan. Este formulario no cambia contraseñas ni documentos.</Texto>
    {error ? <Aviso tono="peligro">{error} Si la ficha cambió, cancelá y actualizala antes de volver a guardar.</Aviso> : null}
    {confirmarSalida ? <Aviso tono="advertencia">Tenés cambios sin guardar. Confirmá si querés descartarlos.</Aviso> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <BotonPrimario titulo="Guardar cambios" tamano="escritorio" cargando={ocupado} deshabilitado={!sucio}
        onPress={() => void guardar()} />
      <BotonPrimario titulo={confirmarSalida ? 'Descartar edición' : 'Cancelar edición'} variante="secundario"
        tamano="escritorio" deshabilitado={ocupado}
        onPress={() => sucio && !confirmarSalida ? setConfirmarSalida(true) : onCancelar()} />
      {confirmarSalida ? <BotonPrimario titulo="Seguir editando" variante="secundario" tamano="escritorio"
        onPress={() => setConfirmarSalida(false)} /> : null}
    </View>
  </View>;
}

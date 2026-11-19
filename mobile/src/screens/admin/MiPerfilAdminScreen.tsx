import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DetalleUsuarioAdmin } from '../../domain/models/Admin';
import { adminRepository } from '../../infrastructure/di';
import { useSesion } from '../../session/SesionProvider';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { FormularioCuentaAdmin } from './FormularioCuentaAdmin';

export function MiPerfilAdminScreen() {
  const { usuario } = useSesion();
  const [cuenta, setCuenta] = useState<DetalleUsuarioAdmin | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [editando, setEditando] = useState(false);
  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setCuenta(await adminRepository.perfil()); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos cargar tu perfil.'); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  return <View style={{ gap: 24, maxWidth: 960 }}>
    <Encabezado titulo="Mi perfil" subtitulo="Tu información personal como administrador de Fixly."
      derecha={<BotonPrimario titulo="Actualizar perfil" variante="secundario" tamano="escritorio"
        deshabilitado={cargando || editando} onPress={() => void cargar()} />} />
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
    {error ? <><Aviso tono="peligro">{error}</Aviso><BotonPrimario titulo="Reintentar perfil"
      onPress={() => void cargar()} /></> : null}
    {cargando ? <ActivityIndicator /> : cuenta && cuenta.id === usuario?.id ? <>
      <Tarjeta style={{ gap: 16 }}>
        {editando ? <FormularioCuentaAdmin key={cuenta.revision} cuenta={cuenta} propio
          onCancelar={() => { setEditando(false); void cargar(); }} onGuardado={(c, m) => {
            setCuenta(c); setEditando(false); setMensaje(m);
          }} /> : <>
          <Texto variante="titulo">{cuenta.nombre} {cuenta.apellido}</Texto>
          <Texto>{cuenta.email}</Texto>
          <Texto variante="caption">Administrador · Cuenta de la sesión actual</Texto>
          <Texto>Teléfono: {cuenta.telefono || 'Sin dato registrado'}</Texto>
          <BotonPrimario titulo="Editar mi información" tamano="escritorio"
            onPress={() => { setEditando(true); setMensaje(''); }} />
        </>}
      </Tarjeta>
      <Aviso titulo="Acceso y seguridad">Tu correo, rol y método de acceso no se cambian desde este formulario.
        No podés desactivar tu propia cuenta.</Aviso>
    </> : null}
  </View>;
}

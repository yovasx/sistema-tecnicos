import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BotonGoogle, googleDisponible } from '../../infrastructure/google/BotonGoogle';
import { authRepository } from '../../infrastructure/di';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { colores } from '../../theme/tokens';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

export function VincularGoogle({ onVinculado, onInteraccion }: {
  onVinculado?: () => void; onInteraccion?: (activo: boolean) => void;
} = {}) {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [salida, setSalida] = useState(false);
  const bloqueo = useRef(false);
  useCambiosSinGuardar(abierto && !!password, ocupado);
  useEffect(() => {
    onInteraccion?.(abierto || ocupado);
    return () => onInteraccion?.(false);
  }, [abierto, ocupado, onInteraccion]);
  if (!googleDisponible()) return null;
  return <View style={{ gap: 16 }}>
    <Texto variante="etiqueta" color={colores.marca} accessibilityRole="button" onPress={() => {
      if (bloqueo.current) return;
      if (abierto && password && !salida) { setSalida(true); return; }
      setPassword(''); setSalida(false); setAbierto(v => !v);
    }}>
      {abierto ? 'Cancelar vinculación' : 'Vincular mi cuenta con Google'}
    </Texto>
    {abierto ? <>
      <Texto variante="caption">Confirma tu contraseña Fixly y selecciona Google con el mismo correo. Esto no cambia tu contraseña.</Texto>
      {salida ? <Aviso tono="advertencia">Vuelve a seleccionar Cancelar vinculación para descartar los datos ingresados.</Aviso> : null}
      <CampoTexto etiqueta="Contraseña actual" value={password} onChangeText={setPassword} esPassword
        editable={!ocupado} maxLength={72} autoComplete="current-password" />
      {password ? <BotonGoogle proposito="vinculacion" onError={setError} onCredencial={async ({ idToken, nonce }) => {
        if (bloqueo.current) return;
        bloqueo.current = true; setOcupado(true); setError('');
        try {
          await authRepository.vincularGoogle(idToken, nonce, password);
          setMensaje('Google quedó vinculado. Puedes usarlo la próxima vez que ingreses.'); setAbierto(false); setPassword('');
          onVinculado?.();
        } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos vincular Google.'); }
        finally { bloqueo.current = false; setOcupado(false); }
      }} /> : null}
    </> : null}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
  </View>;
}

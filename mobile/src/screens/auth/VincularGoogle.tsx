import { useRef, useState } from 'react';
import { View } from 'react-native';
import { BotonGoogle, googleDisponible } from '../../infrastructure/google/BotonGoogle';
import { authRepository } from '../../infrastructure/di';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { colores } from '../../theme/tokens';

export function VincularGoogle() {
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const bloqueo = useRef(false);
  if (!googleDisponible()) return null;
  return <View style={{ gap: 16 }}>
    <Texto variante="etiqueta" color={colores.marca} accessibilityRole="button" onPress={() => setAbierto((v) => !v)}>
      Vincular mi cuenta con Google
    </Texto>
    {abierto ? <>
      <Texto variante="caption">Confirmá tu contraseña Fixly y elegí Google con el mismo correo. Esto no cambia tu contraseña.</Texto>
      <CampoTexto etiqueta="Contraseña actual" value={password} onChangeText={setPassword} esPassword autoComplete="current-password" />
      {password ? <BotonGoogle onError={setError} onCredencial={async ({ idToken, nonce }) => {
        if (bloqueo.current) return;
        bloqueo.current = true; setError('');
        try {
          await authRepository.vincularGoogle(idToken, nonce, password);
          setMensaje('Google quedó vinculado. Podés usarlo la próxima vez que ingreses.'); setAbierto(false); setPassword('');
        } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos vincular Google.'); }
        finally { bloqueo.current = false; }
      }} /> : null}
    </> : null}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
  </View>;
}

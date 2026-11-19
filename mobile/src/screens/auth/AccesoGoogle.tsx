import { useRef, useState } from 'react';
import { View } from 'react-native';
import { BotonGoogle, CredencialGoogle, googleDisponible } from '../../infrastructure/google/BotonGoogle';
import { useSesion } from '../../session/SesionProvider';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { colores } from '../../theme/tokens';

export function AccesoGoogle() {
  const { iniciarGoogle } = useSesion();
  const [error, setError] = useState('');
  const [credencial, setCredencial] = useState<CredencialGoogle | null>(null);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  if (!googleDisponible()) return null;
  async function entrar(c: CredencialGoogle, completar = false) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await iniciarGoogle(c.idToken, c.nonce, completar ? nombre.trim() : undefined, completar ? apellido.trim() : undefined); }
    catch (e) {
      if ((e as { codigo?: string }).codigo === 'GOOGLE_DATOS_REQUERIDOS') setCredencial(c);
      else { setCredencial(null); setError(e instanceof Error ? e.message : 'No pudimos ingresar con Google.'); }
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  return <View style={{ gap: 12 }}>
    {credencial ? <>
      <Texto variante="etiqueta">Completá tu perfil de cliente</Texto>
      <CampoTexto etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={100} />
      <CampoTexto etiqueta="Apellido" value={apellido} onChangeText={setApellido} maxLength={100} />
      <BotonPrimario titulo="Crear mi cuenta con Google" cargando={ocupado} deshabilitado={!nombre.trim() || !apellido.trim()}
        onPress={() => void entrar(credencial, true)} />
      <Texto accessibilityRole="button" color={colores.marca} onPress={() => setCredencial(null)}>Usar otra cuenta</Texto>
    </> : <BotonGoogle onCredencial={entrar} onError={setError} />}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ height: 1, flex: 1, backgroundColor: colores.linea }} />
      <Texto variante="caption">o continuá con tu email</Texto>
      <View style={{ height: 1, flex: 1, backgroundColor: colores.linea }} />
    </View>
  </View>;
}

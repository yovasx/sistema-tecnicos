import { useRef, useState } from 'react';
import { View } from 'react-native';
import { BotonGoogle, CredencialGoogle, googleDisponible } from '../../infrastructure/google/BotonGoogle';
import { useSesion } from '../../session/SesionProvider';
import { CampoTexto } from '../../ui/CampoTexto';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { colores } from '../../theme/tokens';
import { ErrorApi } from '../../infrastructure/http/errores';
import { RegistroGoogle } from '../../domain/models/Google';

export function AccesoGoogle({ proposito = 'acceso', onRegistro, onInteraccion, deshabilitado = false }: {
  proposito?: 'acceso' | RegistroGoogle;
  onRegistro?: (tipo: RegistroGoogle) => void;
  onInteraccion?: (ocupado: boolean) => void;
  deshabilitado?: boolean;
}) {
  const { iniciarGoogle } = useSesion();
  const [error, setError] = useState('');
  const [referencia, setReferencia] = useState('');
  const [credencial, setCredencial] = useState<CredencialGoogle | null>(null);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [registroRequerido, setRegistroRequerido] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const bloqueo = useRef(false);
  if (!googleDisponible()) return null;
  async function entrar(c: CredencialGoogle, completar = false) {
    if (bloqueo.current || deshabilitado) return;
    if (completar) {
      const e: Record<string, string> = {};
      if (nombre.trim().length < 2) e.nombre = 'Ingresa al menos 2 caracteres.';
      if (apellido.trim().length < 2) e.apellido = 'Ingresa al menos 2 caracteres.';
      setErrores(e); if (Object.keys(e).length) return;
    }
    bloqueo.current = true; setOcupado(true); setError(''); setReferencia('');
    setRegistroRequerido(false); onInteraccion?.(true);
    try { await iniciarGoogle(c.idToken, c.nonce, completar ? nombre.trim() : undefined, completar ? apellido.trim() : undefined); }
    catch (e) {
      if ((e as { codigo?: string }).codigo === 'GOOGLE_DATOS_REQUERIDOS') setCredencial(c);
      else {
        setCredencial(null); setError(e instanceof Error ? e.message : 'No pudimos ingresar con Google.');
        if (e instanceof ErrorApi) setReferencia(e.codigo);
        if (e instanceof ErrorApi && e.codigo === 'GOOGLE_REGISTRO_REQUERIDO') setRegistroRequerido(true);
      }
    } finally { bloqueo.current = false; setOcupado(false); onInteraccion?.(false); }
  }
  return <View style={{ gap: 12 }}>
    {credencial ? <>
      <Texto variante="etiqueta">{proposito === 'tecnico' ? 'Completa los datos de tu cuenta técnica' : 'Completa tu perfil de cliente'}</Texto>
      <CampoTexto etiqueta="Nombre para Google" value={nombre} onChangeText={setNombre} maxLength={100}
        error={errores.nombre} editable={!ocupado} />
      <CampoTexto etiqueta="Apellido para Google" value={apellido} onChangeText={setApellido} maxLength={100}
        error={errores.apellido} editable={!ocupado} />
      <BotonPrimario titulo="Crear mi cuenta con Google" cargando={ocupado} deshabilitado={!nombre.trim() || !apellido.trim()}
        onPress={() => void entrar(credencial, true)} />
      <Texto accessibilityRole="button" color={colores.marca} onPress={() => { if (!ocupado) setCredencial(null); }}>Usar otra cuenta</Texto>
    </> : <BotonGoogle proposito={proposito} deshabilitado={deshabilitado || ocupado} onCredencial={entrar} onError={setError} />}
    {proposito === 'tecnico' ? <Aviso titulo="Cuenta técnica pendiente de validación">
      Google confirma tu acceso, no tu aprobación profesional. Después completarás el CI, documentos,
      especialidades y cobertura. No recibirás servicios hasta la aprobación de tu expediente.
    </Aviso> : null}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {error && referencia ? <Texto variante="caption">Referencia de acceso: {referencia}</Texto> : null}
    {registroRequerido && onRegistro ? <View style={{ gap: 12 }}>
      <BotonPrimario titulo="Crear cuenta de cliente personal" variante="secundario"
        onPress={() => onRegistro('cliente')} />
      <Texto variante="caption">El personal técnico se incorpora mediante invitación de coordinación, no por registro público.</Texto>
    </View> : null}
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={{ height: 1, flex: 1, backgroundColor: colores.linea }} />
      <Texto variante="caption">o continúa con tu correo electrónico</Texto>
      <View style={{ height: 1, flex: 1, backgroundColor: colores.linea }} />
    </View>
  </View>;
}

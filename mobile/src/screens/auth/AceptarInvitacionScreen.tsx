import { useRef, useState } from 'react';
import { View } from 'react-native';
import { invitacionRepository } from '../../infrastructure/di';
import { MarcoAuth } from './MarcoAuth';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Aviso } from '../../ui/Aviso';
import { Texto } from '../../ui/Texto';
import { colores } from '../../theme/tokens';

/** El permiso y las contraseñas permanecen solo en memoria, nunca en URL/storage. */
export function AceptarInvitacionScreen({ onEntrar }: { onEntrar: () => void }) {
  const [email, setEmail] = useState('');
  const [permiso, setPermiso] = useState('');
  const [password, setPassword] = useState('');
  const [repeticion, setRepeticion] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const bloqueo = useRef(false);
  async function aceptar() {
    if (bloqueo.current) return;
    if (!email.trim() || !/^[a-f0-9]{64}$/.test(permiso.trim()) || password.length < 10 || password !== repeticion) {
      setError('Revisa el correo, el código de invitación y las contraseñas. Usa al menos 10 caracteres y repite la misma contraseña.'); return;
    }
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      await invitacionRepository.aceptar(email.trim(), permiso.trim(), password);
      setPassword(''); setRepeticion(''); setPermiso(''); setListo(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos activar la cuenta.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <MarcoAuth onVolver={ocupado ? undefined : onEntrar}>
    <View style={{ gap: 8 }}><Texto variante="titulo">Activa tu cuenta</Texto>
      <Texto color={colores.secundario}>Usa la invitación enviada por la administración y selecciona tu propia contraseña.</Texto></View>
    {listo ? <><Aviso tono="exito" titulo="Cuenta activada">Ya puedes iniciar sesión. Si eres técnico, completa el expediente para solicitar la aprobación.</Aviso>
      <BotonPrimario titulo="Ir a iniciar sesión" onPress={onEntrar} /></> : <>
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      <CampoTexto etiqueta="Correo de la invitación" value={email} onChangeText={setEmail} keyboardType="email-address"
        autoCapitalize="none" maxLength={150} editable={!ocupado} />
      <CampoTexto etiqueta="Código de invitación" value={permiso} onChangeText={setPermiso} autoCapitalize="none"
        autoCorrect={false} maxLength={64} editable={!ocupado} />
      <CampoTexto etiqueta="Tu nueva contraseña" value={password} onChangeText={setPassword}
        esPassword autoComplete="new-password" maxLength={72} editable={!ocupado} />
      <CampoTexto etiqueta="Repite tu nueva contraseña" value={repeticion} onChangeText={setRepeticion}
        esPassword autoComplete="new-password" maxLength={72} editable={!ocupado} />
      <Texto variante="caption">La invitación vence en 24 horas y solo se puede utilizar una vez.</Texto>
      <BotonPrimario titulo="Activar cuenta" cargando={ocupado} onPress={() => void aceptar()} />
    </>}
  </MarcoAuth>;
}

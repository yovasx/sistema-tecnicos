import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { recuperacionRepository as repo } from '../../infrastructure/di';
import { MarcoAuth } from './MarcoAuth';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { colores } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

/** Credenciales temporales solo en memoria, nunca en URL ni storage. */
export function RecuperacionScreen({ onEntrar }: { onEntrar: () => void }) {
  const [paso, setPaso] = useState(0);
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [solicitud, setSolicitud] = useState('');
  const [permiso, setPermiso] = useState('');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [espera, setEspera] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const { esDesktop } = useResponsive();
  const tamano = esDesktop ? 'escritorio' : 'movil';
  useEffect(() => {
    const t = setInterval(() => setEspera((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => { if (!bloqueo.current) onEntrar(); return true; });
    return () => s.remove();
  }, [onEntrar]);
  async function accion(f: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await f(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos completar la recuperación.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  async function enviar() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Ingresa un correo válido.'); return; }
    await accion(async () => {
      const r = await repo.solicitar(email.trim());
      setSolicitud(r.solicitudId); setMensaje(r.mensaje); setCodigo(''); setEspera(60); setPaso(1);
    });
  }
  const titulos = ['Recupera tu acceso', 'Revisa tu correo', 'Selecciona una nueva contraseña', 'Contraseña actualizada'];
  return <MarcoAuth onVolver={() => { if (!ocupado) onEntrar(); }}>
    <Ionicons name={paso === 3 ? 'checkmark-circle-outline' : 'lock-open-outline'} size={32} color={colores.marca} />
    <Texto variante="titulo">{titulos[paso]}</Texto>
    {paso < 3 ? <View style={{ flexDirection: 'row', gap: 8 }}>
      {['Email', 'Código', 'Contraseña'].map((t, i) => <View key={t} style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 3, borderRadius: 3, backgroundColor: paso >= i ? colores.marca : colores.linea }} />
        <Texto variante="caption" color={paso === i ? colores.marca : colores.terciario}>{i + 1}. {t}</Texto>
      </View>)}
    </View> : null}
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {paso === 0 ? <>
      <Texto color={colores.secundario}>Te ayudamos a cambiar la contraseña de tu cuenta Fixly.</Texto>
      <CampoTexto etiqueta="Correo electrónico" value={email} onChangeText={setEmail} editable={!ocupado}
        keyboardType="email-address" autoComplete="email" autoCapitalize="none" onSubmitEditing={() => void enviar()} />
      <BotonPrimario titulo="Enviar código" tamano={tamano} cargando={ocupado} onPress={() => void enviar()} />
      <Texto variante="caption">Si ingresas solo con Google, usa “Continuar con Google”. Fixly no cambia tu contraseña de Google.</Texto>
    </> : null}
    {paso === 1 ? <>
      <Aviso titulo={email}>{mensaje}</Aviso>
      <CampoTexto etiqueta="Código de 6 dígitos" value={codigo} onChangeText={(v) => setCodigo(v.replace(/\D/g, ''))}
        keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" editable={!ocupado} />
      <Texto variante="caption">Vence en 10 minutos. Tienes hasta 5 intentos. Revisa también la carpeta de correo no deseado.</Texto>
      <BotonPrimario titulo="Verificar código" tamano={tamano} cargando={ocupado} deshabilitado={!/^\d{6}$/.test(codigo)}
        onPress={() => void accion(async () => {
          const r = await repo.confirmar(solicitud, codigo); setPermiso(r.permiso); setCodigo(''); setMensaje(''); setPaso(2);
        })} />
      <BotonPrimario titulo={espera ? `Reenviar en ${espera} s` : 'Reenviar código'} variante="secundario"
        tamano={tamano} deshabilitado={espera > 0 || ocupado} onPress={() => void enviar()} />
      <Texto variante="etiqueta" color={colores.marca} accessibilityRole="button"
        onPress={() => { if (!ocupado) { setPaso(0); setError(''); setMensaje(''); } }}>Cambiar correo</Texto>
    </> : null}
    {paso === 2 ? <>
      <CampoTexto etiqueta="Nueva contraseña" value={password} onChangeText={setPassword} esPassword
        autoComplete="new-password" editable={!ocupado} />
      <CampoTexto etiqueta="Repite la contraseña" value={repetida} onChangeText={setRepetida} esPassword
        autoComplete="new-password" editable={!ocupado} />
      <Texto variante="caption">Entre 8 y 72 caracteres. Las sesiones anteriores se cerrarán.</Texto>
      <BotonPrimario titulo="Guardar contraseña" tamano={tamano} cargando={ocupado} onPress={() => {
        if (password.length < 8 || password.length > 72 || password !== repetida) {
          setError('Usa entre 8 y 72 caracteres y repite la misma contraseña.'); return;
        }
        void accion(async () => {
          await repo.restablecer(solicitud, permiso, password);
          setPermiso(''); setPassword(''); setRepetida(''); setSolicitud(''); setPaso(3);
        });
      }} />
    </> : null}
    {paso === 3 ? <>
      <Texto color={colores.secundario}>Tu acceso ya está actualizado. Inicia sesión con tu nueva contraseña.</Texto>
      <BotonPrimario titulo="Volver a iniciar sesión" tamano={tamano} onPress={onEntrar} />
    </> : null}
  </MarcoAuth>;
}

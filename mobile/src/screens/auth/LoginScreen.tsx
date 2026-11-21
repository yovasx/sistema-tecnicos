import { Keyboard, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLoginForm } from './useLoginForm';
import { MarcoAuth } from './MarcoAuth';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { colores } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { AccesoGoogle } from './AccesoGoogle';

export interface LoginScreenProps {
  onVolver?: () => void;
  onCrearCuenta?: () => void;
  onRecuperar?: () => void;
}
export function LoginScreen({ onVolver, onCrearCuenta, onRecuperar }: LoginScreenProps) {
  const { email, setEmail, password, setPassword, errorLogin, manejarSubmit, ocupado } = useLoginForm();
  const { esDesktop } = useResponsive();
  return <MarcoAuth onVolver={onVolver}>
    <View style={{ gap: 10 }}>
      <Ionicons name="log-in-outline" size={28} color={colores.marca} />
      <Texto variante="titulo">Bienvenido de nuevo</Texto>
      <Texto color={colores.secundario}>Ingresa a tu cuenta y continúa donde lo dejaste.</Texto>
    </View>
    {errorLogin ? <Aviso tono="peligro">{errorLogin}</Aviso> : null}
    <AccesoGoogle />
    <CampoTexto etiqueta="Correo electrónico" value={email} onChangeText={setEmail} editable={!ocupado}
      keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="nombre@ejemplo.com" />
    <View style={{ gap: 8 }}>
      <CampoTexto etiqueta="Contraseña" value={password} onChangeText={setPassword} editable={!ocupado} esPassword
        autoComplete="current-password" onSubmitEditing={() => { Keyboard.dismiss(); void manejarSubmit(); }} />
      <Texto variante="etiqueta" color={colores.marca} accessibilityRole="button" onPress={onRecuperar}
        style={{ alignSelf: 'flex-end', paddingVertical: 8 }}>¿Olvidaste tu contraseña?</Texto>
    </View>
    <BotonPrimario titulo="Ingresar" tamano={esDesktop ? 'escritorio' : 'movil'} cargando={ocupado}
      onPress={() => { Keyboard.dismiss(); void manejarSubmit(); }} />
    {onCrearCuenta ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
      <Texto variante="caption">¿No tienes cuenta?</Texto>
      <Texto variante="etiqueta" color={colores.marca} accessibilityRole="button" onPress={onCrearCuenta}>Crear cuenta</Texto>
    </View> : null}
  </MarcoAuth>;
}

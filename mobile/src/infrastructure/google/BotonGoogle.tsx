import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { useRef, useState } from 'react';
import { authRepository } from '../di';
import { BotonPrimario } from '../../ui/BotonPrimario';

export interface CredencialGoogle { idToken: string; nonce: string }
export interface BotonGoogleProps {
  onCredencial: (credencial: CredencialGoogle) => Promise<void>;
  onError: (mensaje: string) => void;
}
export function googleDisponible() {
  return !isRunningInExpoGo() && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    && process.env.EXPO_PUBLIC_GOOGLE_NATIVE_ENABLED === 'true'
    && (Platform.OS !== 'ios' || !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
}
export function BotonGoogle({ onCredencial, onError }: BotonGoogleProps) {
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  if (!googleDisponible()) return null;
  return <BotonPrimario titulo="Continuar con Google" variante="secundario" cargando={ocupado} onPress={() => {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true);
    void (async () => {
      try {
        const { nonce } = await authRepository.desafioGoogle();
        const { GoogleOneTapSignIn, isSuccessResponse } = await import('react-native-nitro-google-signin');
        GoogleOneTapSignIn.configure({
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
          nonce, offlineAccess: false,
        });
        await GoogleOneTapSignIn.checkPlayServices();
        // Interactivo: evita reutilizar un idToken cacheado con un nonce anterior.
        const respuesta = await GoogleOneTapSignIn.presentExplicitSignIn();
        if (isSuccessResponse(respuesta)) await onCredencial({ idToken: respuesta.data.idToken, nonce });
      } catch { onError('No pudimos iniciar Google. Verificá la conexión y la configuración del development build.'); }
      finally { bloqueo.current = false; setOcupado(false); }
    })();
  }} />;
}

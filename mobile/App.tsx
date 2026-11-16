import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider } from './src/session/SesionProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { authRepository, tokenStorage } from './src/infrastructure/di';
import { useFuentes } from './src/theme/useFuentes';

/**
 * Raíz de la app.
 *
 * Mientras las fuentes no cargan no se pinta nada, para evitar el salto de
 * tipografía del primer frame. Después: proveedores (safe area + sesión) y el
 * navegador raíz.
 */
export default function App() {
  const { cargadas, error } = useFuentes();

  if (error) {
    console.error('Error cargando fuentes:', error);
  }
  if (!cargadas) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SesionProvider authRepository={authRepository} tokenStorage={tokenStorage}>
        <RootNavigator />
      </SesionProvider>
    </SafeAreaProvider>
  );
}

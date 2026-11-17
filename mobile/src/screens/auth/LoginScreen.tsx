import { Ionicons } from '@expo/vector-icons';
import { Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginForm } from './useLoginForm';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { colores } from '../../theme/tokens';

export interface LoginScreenProps {
  /** Vuelve a la bienvenida (F01). */
  onVolver?: () => void;
  /** Lleva al selector de tipo de cuenta para registrarse. */
  onCrearCuenta?: () => void;
}

/**
 * F03 · Login del teléfono.
 *
 * Mantiene el contrato anti-enumeración del backend y suma las dos salidas del
 * flujo público: volver a la bienvenida y crear una cuenta. La recuperación de
 * contraseña todavía no existe como flujo, así que se ofrece soporte real.
 */
export function LoginScreen({ onVolver, onCrearCuenta }: LoginScreenProps) {
  const { email, setEmail, password, setPassword, errorLogin, manejarSubmit } = useLoginForm();

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={estilos.teclado}
          keyboardVerticalOffset={0}
        >
          <View style={estilos.contenido}>
            {onVolver ? (
              <Pressable
                accessibilityRole="button"
                onPress={onVolver}
                style={estilos.volver}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={18} color={colores.secundario} />
                <Texto variante="etiqueta" color={colores.secundario}>
                  Volver
                </Texto>
              </Pressable>
            ) : null}

            <View style={estilos.logo}>
              <Texto variante="display" color="#2F6BFF">
                Fixly
              </Texto>
              <Texto variante="caption" color="#475467">
                Servicios técnicos en La Paz
              </Texto>
            </View>

            <Encabezado
              titulo="Iniciar sesión"
              subtitulo="Tu cuenta para pedir o atender servicios"
            />

            {errorLogin ? (
              <Texto variante="caption" color="#B42318" style={estilos.errorGlobal}>
                {errorLogin}
              </Texto>
            ) : null}

            <View style={estilos.formulario}>
              <CampoTexto
                etiqueta="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <CampoTexto
                etiqueta="Contraseña"
                value={password}
                onChangeText={setPassword}
                esPassword
                autoComplete="current-password"
                textContentType="password"
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                  void manejarSubmit();
                }}
              />
            </View>

            <BotonPrimario
              titulo="Entrar"
              onPress={() => {
                Keyboard.dismiss();
                void manejarSubmit();
              }}
            />

            {onCrearCuenta ? (
              <View style={estilos.pie}>
                <Texto variante="caption" color="#667085">
                  ¿No tenés cuenta?
                </Texto>
                <Texto
                  variante="etiqueta"
                  color={colores.marca}
                  onPress={onCrearCuenta}
                  accessibilityRole="button"
                >
                  Crear cuenta
                </Texto>
              </View>
            ) : null}

            <Texto
              variante="caption"
              color="#667085"
              centrado
              onPress={() => void Linking.openURL('mailto:soporte@fixly.bo')}
              accessibilityRole="link"
            >
              ¿Olvidaste tu contraseña? Escribí a soporte@fixly.bo
            </Texto>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ContenedorApp>
  );
}

const estilos = StyleSheet.create({
  seguro: { flex: 1 },
  teclado: { flex: 1 },
  contenido: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
    justifyContent: 'center',
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: -4,
  },
  logo: {
    alignItems: 'center',
    gap: 4,
  },
  formulario: {
    gap: 16,
  },
  errorGlobal: {
    textAlign: 'center',
  },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});

import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../session/SesionProvider';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { ErrorApi } from '../../infrastructure/http/errores';

/** Pantalla de login (F03). */
export function LoginScreen() {
  const { iniciarSesion } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState<string | null>(null);

  const manejarSubmit = async () => {
    Keyboard.dismiss();
    setErrorLogin(null);
    try {
      await iniciarSesion(email.trim(), password);
    } catch (e) {
      const error = e as ErrorApi;
      if (error.codigo === 'CREDENCIALES_INVALIDAS' || error.codigo === 'CUENTA_INACTIVA') {
        setErrorLogin(error.message);
      } else if (error.sinConexion) {
        setErrorLogin('Sin conexión: revisá IP, puerto y firewall');
      } else {
        setErrorLogin(error.message);
      }
    }
  };

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={estilos.teclado}
          keyboardVerticalOffset={0}
        >
          <View style={estilos.contenido}>
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
                onSubmitEditing={manejarSubmit}
              />
            </View>

            <BotonPrimario titulo="Entrar" onPress={manejarSubmit} />

            <View style={estilos.pie}>
              <Texto variante="caption" color="#667085">
                ¿Olvidaste la contraseña? Próximamente.
              </Texto>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ContenedorApp>
  );
}

const estilos = StyleSheet.create({
  seguro: {
    flex: 1,
  },
  teclado: {
    flex: 1,
  },
  contenido: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 24,
    justifyContent: 'center',
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
    alignItems: 'center',
    marginTop: 8,
  },
});

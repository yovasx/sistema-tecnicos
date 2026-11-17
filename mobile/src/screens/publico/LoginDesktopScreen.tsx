import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLoginForm } from '../auth/useLoginForm';
import { CampoTexto } from '../../ui/CampoTexto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { colores, espacio } from '../../theme/tokens';

export interface LoginDesktopScreenProps {
  /** Vuelve a la landing pública (W62). */
  onVolver?: () => void;
}

/**
 * Login público de escritorio (W63): panel de marca a la izquierda, formulario
 * a la derecha. Mismo contrato que el login del teléfono.
 */
export function LoginDesktopScreen({ onVolver }: LoginDesktopScreenProps) {
  const { email, setEmail, password, setPassword, errorLogin, manejarSubmit } = useLoginForm();
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <View style={estilos.raiz}>
      <View style={estilos.marca}>
        <View style={estilos.marcaTop}>
          {onVolver ? (
            <Texto onPress={onVolver} variante="etiqueta" color="#DCE7FF">
              ← Volver al inicio
            </Texto>
          ) : null}
          <View style={estilos.marcaArriba}>
            <Ionicons name="build" size={22} color={colores.superficie} />
            <Texto variante="titulo" color={colores.superficie}>
              Fixly
            </Texto>
          </View>
        </View>
        <View style={estilos.marcaCentro}>
          <Texto variante="display" color={colores.superficie}>
            La Paz, Bolivia
          </Texto>
          <Texto variante="cuerpo" color="#DCE7FF">
            Servicios técnicos verificados para el hogar.
          </Texto>
        </View>
        <View style={estilos.marcaAbajo}>
          <Ionicons name="help-circle-outline" size={18} color={colores.superficie} />
          <Texto variante="caption" color="#DCE7FF">
            Centro de ayuda
          </Texto>
        </View>
      </View>

      <SafeAreaView style={estilos.formularioLado}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={estilos.formulario}
          keyboardVerticalOffset={0}
        >
          <View style={estilos.tarjeta}>
            <Texto variante="titulo">Bienvenido de nuevo</Texto>
            <Texto variante="caption" color={colores.secundario}>
              Ingresá para continuar
            </Texto>

            {errorLogin ? (
              <Texto variante="caption" color={colores.peligro}>
                {errorLogin}
              </Texto>
            ) : null}
            {aviso ? (
              <Texto variante="caption" color={colores.advertencia}>
                {aviso}
              </Texto>
            ) : null}

            <CampoTexto
              etiqueta="Correo electrónico"
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

            <Texto variante="caption" color={colores.marca}>
              ¿Olvidaste tu contraseña?
            </Texto>

            <BotonPrimario
              titulo="Ingresar"
              tamano="escritorio"
              onPress={() => {
                Keyboard.dismiss();
                setAviso(null);
                void manejarSubmit();
              }}
            />

            <View style={estilos.separador}>
              <View style={estilos.linea} />
              <Texto variante="caption">o</Texto>
              <View style={estilos.linea} />
            </View>

            <BotonPrimario
              variante="secundario"
              tamano="escritorio"
              titulo="Crear cuenta"
              onPress={() => setAviso('El registro aún no está disponible: es parte de V2.')}
            />

            <View style={estilos.nota}>
              <Ionicons name="shield-checkmark" size={16} color={colores.exito} />
              <Texto variante="caption">Tu rol se detecta automáticamente</Texto>
            </View>
          </View>

          <Texto variante="caption" color={colores.terciario} centrado>
            Fixly Bolivia S.R.L. · Soporte: soporte@fixly.bo
          </Texto>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colores.superficie,
  },
  marca: {
    flex: 1,
    backgroundColor: colores.marcaFuerte,
    padding: espacio.xxl,
    justifyContent: 'space-between',
  },
  marcaTop: {
    gap: espacio.base,
  },
  marcaArriba: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  marcaCentro: {
    gap: espacio.md,
  },
  marcaAbajo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  formularioLado: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  formulario: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: espacio.xl,
    gap: espacio.base,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colores.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.xl,
    gap: espacio.base,
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
  },
  linea: {
    flex: 1,
    height: 1,
    backgroundColor: colores.linea,
  },
  nota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    justifyContent: 'center',
  },
});

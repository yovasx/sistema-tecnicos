import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, TextInputProps, TextStyle, View } from 'react-native';
import { useResponsive } from '../theme/responsive';
import { colores, fuentes, radio, tamanos } from '../theme/tokens';
import { Texto } from './Texto';

export interface CampoTextoProps extends Omit<TextInputProps, 'style'> {
  etiqueta: string;
  error?: string;
  esPassword?: boolean;
}

/**
 * Campo de texto con etiqueta y estado de error. El borde cambia de color en
 * foco y en error; nunca se usa solo el color para comunicar el problema,
 * porque abajo va el mensaje.
 */
export function CampoTexto({
  etiqueta,
  error,
  esPassword = false,
  ...rest
}: CampoTextoProps) {
  const [enfocado, setEnfocado] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const { esDesktop } = useResponsive();

  return (
    <View style={estilos.contenedor}>
      <Texto variante="etiqueta" color={colores.secundario} style={estilos.etiqueta}>
        {etiqueta}
      </Texto>
      <View
        style={[
          estilos.caja,
          esDesktop && estilos.cajaDesktop,
          rest.editable === false && estilos.cajaDeshabilitada,
          enfocado ? estilos.cajaEnfocada : null,
          error ? estilos.cajaError : null,
        ]}
      >
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? etiqueta}
          style={[estilos.entrada, esDesktop && estilos.entradaDesktop,
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as unknown as TextStyle)]}
          underlineColorAndroid="transparent"
          placeholderTextColor={colores.deshabilitado}
          secureTextEntry={esPassword && !verClave}
          onFocus={(e) => {
            setEnfocado(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            rest.onBlur?.(e);
          }}
        />
        {esPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            disabled={rest.editable === false}
            onPress={() => setVerClave((v) => !v)}
            hitSlop={8}
          >
            <Texto variante="etiqueta" color={colores.marca}>
              {verClave ? 'Ocultar' : 'Mostrar'}
            </Texto>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Texto variante="caption" color={colores.peligro}>
          {error}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: 6,
  },
  etiqueta: {
    marginLeft: 2,
  },
  caja: {
    minHeight: 52,
    borderRadius: radio.control,
    borderWidth: 1,
    borderColor: colores.lineaFuerte,
    backgroundColor: colores.superficie,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cajaEnfocada: {
    borderColor: colores.marca,
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 0 3px rgba(47,107,255,0.14)' } : {}),
  },
  cajaDesktop: { minHeight: 44 },
  entradaDesktop: { paddingVertical: 10, fontSize: 14 },
  cajaDeshabilitada: { backgroundColor: colores.fondo, opacity: 0.65 },
  cajaError: {
    borderColor: colores.peligro,
  },
  entrada: {
    flex: 1,
    minWidth: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: fuentes.cuerpo,
    fontSize: tamanos.cuerpo,
    color: colores.tinta,
    paddingVertical: 14,
  },
});

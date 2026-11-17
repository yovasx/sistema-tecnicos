import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
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

  return (
    <View style={estilos.contenedor}>
      <Texto variante="etiqueta" color={colores.secundario} style={estilos.etiqueta}>
        {etiqueta}
      </Texto>
      <View
        style={[
          estilos.caja,
          enfocado ? estilos.cajaEnfocada : null,
          error ? estilos.cajaError : null,
        ]}
      >
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? etiqueta}
          style={estilos.entrada}
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
  },
  cajaError: {
    borderColor: colores.peligro,
  },
  entrada: {
    flex: 1,
    fontFamily: fuentes.cuerpo,
    fontSize: tamanos.cuerpo,
    color: colores.tinta,
    paddingVertical: 14,
  },
});

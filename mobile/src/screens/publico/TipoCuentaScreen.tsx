import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Texto } from '../../ui/Texto';
import { useResponsive } from '../../theme/responsive';
import { colores, espacio, radio, sombraTarjeta } from '../../theme/tokens';
import { TipoCliente } from '../../domain/models/Sesion';
import { MarcoPublico } from './MarcoPublico';

export interface TipoCuentaScreenProps {
  onVolver: () => void;
  onElegir: (tipo: TipoCliente) => void;
  onEntrar: () => void;
  onTecnico: () => void;
}

/**
 * Segundo paso del flujo público: ¿para quién es la cuenta?
 *
 * Separa hogar, empresa y técnico antes de pedir un solo dato. El alta de
 * técnicos implica validación documental, así que no se mezcla con el registro
 * de clientes: se resuelve entrando con una cuenta existente.
 */
export function TipoCuentaScreen({ onVolver, onElegir, onEntrar, onTecnico }: TipoCuentaScreenProps) {
  const { esDesktop } = useResponsive();

  return (
    <MarcoPublico
      onVolver={onVolver}
      volverTexto="Volver"
      destacados={
        esDesktop
          ? [
              'Precio estimado antes de confirmar',
              'Revisión de identidad y certificados',
              'Seguimiento del servicio en la app',
            ]
          : undefined
      }
    >
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            estilos.scroll,
            esDesktop ? estilos.scrollEscritorio : null,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[estilos.caja, esDesktop ? estilos.cajaEscritorio : null]}>
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

            <View style={estilos.encabezado}>
              <Texto variante="titulo">¿Para quién es la cuenta?</Texto>
              <Texto variante="cuerpo" color={colores.secundario}>
                Elegí el perfil y te pedimos solo los datos que hacen falta.
              </Texto>
            </View>

            <View style={estilos.opciones}>
              <OpcionCuenta
                icono="home"
                titulo="Para mi hogar"
                detalle="Pedí servicios para tu casa y seguí cada trabajo."
                onPress={() => onElegir('persona')}
              />
              <OpcionCuenta
                icono="business"
                titulo="Para mi empresa"
                detalle="Gestioná servicios y facturación con NIT."
                onPress={() => onElegir('empresa')}
              />
              <OpcionCuenta
                icono="construct"
                titulo="Soy técnico"
                detalle="Las cuentas de técnico se habilitan con validación."
                insignia="Con validación"
                onPress={onTecnico}
              />
            </View>


            <View style={estilos.pie}>
              <Texto variante="caption" color={colores.secundario}>
                ¿Ya tenés cuenta?
              </Texto>
              <Texto
                variante="etiqueta"
                color={colores.marca}
                onPress={onEntrar}
                accessibilityRole="button"
              >
                Iniciar sesión
              </Texto>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </MarcoPublico>
  );
}

function OpcionCuenta({
  icono,
  titulo,
  detalle,
  insignia,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
  insignia?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [estilos.opcion, pressed ? estilos.opcionPresionada : null]}
    >
      <View style={estilos.opcionIcono}>
        <Ionicons name={icono} size={22} color={colores.marca} />
      </View>
      <View style={estilos.opcionTexto}>
        <View style={estilos.opcionTitulo}>
          <Texto variante="subtitulo">{titulo}</Texto>
          {insignia ? (
            <View style={estilos.insignia}>
              <Texto variante="caption" color={colores.terciario}>
                {insignia}
              </Texto>
            </View>
          ) : null}
        </View>
        <Texto variante="caption" color={colores.secundario}>
          {detalle}
        </Texto>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colores.deshabilitado} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  seguro: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.base,
    paddingBottom: espacio.xl,
  },
  scrollEscritorio: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: espacio.xl,
  },
  caja: {
    flex: 1,
    gap: espacio.lg,
  },
  cajaEscritorio: {
    flex: 0,
    width: '100%',
    maxWidth: 560,
    backgroundColor: colores.superficie,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.xl,
    ...sombraTarjeta,
  },
  volver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encabezado: {
    gap: espacio.sm,
  },
  opciones: {
    gap: espacio.md,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    backgroundColor: colores.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.base,
  },
  opcionPresionada: {
    borderColor: colores.marca,
    backgroundColor: colores.marcaSuave,
  },
  opcionIcono: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colores.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionTexto: {
    flex: 1,
    gap: 2,
  },
  opcionTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    flexWrap: 'wrap',
  },
  insignia: {
    borderRadius: radio.chip,
    borderWidth: 1,
    borderColor: colores.linea,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  avisoTecnicos: {
    gap: espacio.md,
  },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'auto',
  },
});

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../session/SesionProvider';
import { Aviso } from '../../ui/Aviso';
import { Chip } from '../../ui/Chip';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Texto } from '../../ui/Texto';
import { colores, espacio } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

export function PanelTecnico() {
  const { usuario } = useSesion();
  const { esDesktop } = useResponsive();

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <View style={[estilos.contenido, esDesktop && estilos.contenidoDesktop]}>
          <Encabezado
            titulo="Panel técnico"
            subtitulo={usuario?.nombre ?? '—'}
          />
          <View style={estilos.estado}>
            <Texto variante="etiqueta" color={colores.secundario}>
              Disponibilidad
            </Texto>
            <View style={estilos.chips}>
              <Chip tono="exito" texto="Disponible" />
              <Chip texto="Cobertura: Sopocachi" />
            </View>
          </View>
          <Aviso tono="advertencia" titulo="Pendiente de V2">
            Órdenes entrantes, ruta y diagnóstico (F29/F31) dependen del
            controlador de orders.
          </Aviso>
        </View>
      </SafeAreaView>
    </ContenedorApp>
  );
}

const estilos = StyleSheet.create({
  seguro: { flex: 1 },
  contenido: {
    flex: 1,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.lg,
    gap: espacio.lg,
  },
  estado: {
    padding: espacio.lg,
    backgroundColor: colores.fondo,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.linea,
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  contenidoDesktop: {
    paddingHorizontal: 0,
    paddingTop: 0,
    maxWidth: 1080,
  },
});

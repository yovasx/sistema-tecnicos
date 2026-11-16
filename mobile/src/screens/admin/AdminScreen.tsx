import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../session/SesionProvider';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Texto } from '../../ui/Texto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { colores, espacio } from '../../theme/tokens';

export function AdminScreen() {
  const { usuario, cerrarSesion } = useSesion();

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <View style={estilos.contenido}>
          <Encabezado
            titulo="Panel administrativo"
            subtitulo={usuario?.nombre ?? 'Administrador'}
          />
          <View style={estilos.caja}>
            <Texto variante="cuerpo" centrado>
              El panel administrativo se usa desde el backoffice web.
            </Texto>
            <Texto variante="caption" color={colores.secundario} centrado style={estilos.nota}>
              Acá solo se muestra el usuario logueado y la opción de cerrar sesión.
            </Texto>
          </View>
          <BotonPrimario
            variante="secundario"
            titulo="Cerrar sesión"
            onPress={cerrarSesion}
          />
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
    justifyContent: 'center',
  },
  caja: {
    padding: espacio.xl,
    backgroundColor: colores.fondo,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.linea,
    gap: 8,
    alignItems: 'center',
  },
  nota: {
    marginTop: 4,
  },
});

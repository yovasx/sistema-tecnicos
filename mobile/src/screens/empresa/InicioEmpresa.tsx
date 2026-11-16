import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../session/SesionProvider';
import { Chip } from '../../ui/Chip';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Texto } from '../../ui/Texto';
import { colores, espacio } from '../../theme/tokens';

export function InicioEmpresa() {
  const { usuario } = useSesion();

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <View style={estilos.contenido}>
          <Encabezado
            titulo={usuario?.nombre ?? 'Empresa'}
            subtitulo={usuario?.razonSocial ?? 'Cliente empresa'}
          />
          <View style={estilos.datos}>
            <View style={estilos.dato}>
              <Texto variante="etiqueta" color={colores.secundario}>
                NIT
              </Texto>
              <Texto variante="cuerpo">{usuario?.nit ?? '—'}</Texto>
            </View>
            <View style={estilos.dato}>
              <Texto variante="etiqueta" color={colores.secundario}>
                Razón social
              </Texto>
              <Texto variante="cuerpo">{usuario?.razonSocial ?? '—'}</Texto>
            </View>
            <View style={estilos.dato}>
              <Texto variante="etiqueta" color={colores.secundario}>
                Email
              </Texto>
              <Texto variante="cuerpo">{usuario?.email ?? '—'}</Texto>
            </View>
          </View>
          <Chip tono="marca" texto="Órdenes y facturación pendientes (V2)" />
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
  datos: {
    gap: espacio.md,
  },
  dato: {
    padding: espacio.lg,
    backgroundColor: colores.fondo,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colores.linea,
    gap: 4,
  },
});

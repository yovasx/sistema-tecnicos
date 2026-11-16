import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../session/SesionProvider';
import { Chip } from '../../ui/Chip';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Texto } from '../../ui/Texto';
import { colores, espacio } from '../../theme/tokens';
import { esClienteEmpresa } from '../../domain/models/Sesion';

export function PerfilCliente() {
  const { usuario, cerrarSesion } = useSesion();
  const esEmpresa = esClienteEmpresa(usuario);

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <View style={estilos.contenido}>
          <Encabezado titulo="Perfil" />
          <View style={estilos.ficha}>
            <Texto variante="cuerpoFuerte">{usuario?.nombre ?? '—'}</Texto>
            <Texto variante="caption" color={colores.secundario}>
              {usuario?.email ?? '—'}
            </Texto>
            <View style={estilos.chips}>
              <Chip texto={usuario?.rol ?? '—'} />
              {esEmpresa && <Chip tono="marca" texto="Empresa" />}
            </View>
            {esEmpresa && usuario?.razonSocial && (
              <>
                <Texto variante="etiqueta" color={colores.secundario} style={estilos.label}>
                  Razón social
                </Texto>
                <Texto variante="cuerpo">{usuario.razonSocial}</Texto>
              </>
            )}
            {esEmpresa && usuario?.nit && (
              <>
                <Texto variante="etiqueta" color={colores.secundario} style={estilos.label}>
                  NIT
                </Texto>
                <Texto variante="cuerpo">{usuario.nit}</Texto>
              </>
            )}
          </View>
          <View style={estilos.botonCerrar}>
            <Texto onPress={cerrarSesion} variante="etiqueta" color="#B42318">
              Cerrar sesión
            </Texto>
          </View>
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
  ficha: {
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
  label: {
    marginTop: 12,
  },
  botonCerrar: {
    alignItems: 'center',
    paddingTop: espacio.base,
  },
});

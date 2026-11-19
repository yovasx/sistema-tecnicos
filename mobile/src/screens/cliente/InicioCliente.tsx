import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Texto } from '../../ui/Texto';
import { Tarjeta } from '../../ui/Tarjeta';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Aviso } from '../../ui/Aviso';
import { useResponsive } from '../../theme/responsive';
import { useSesion } from '../../session/SesionProvider';
import { colores, espacio } from '../../theme/tokens';
import { useCategoriasPublicas } from '../publico/useCategoriasPublicas';
import { desdeCategoria, iconoCategoria } from '../publico/categorias';
import { bolivianos } from '../../ui/formato';
import { BotonPrimario } from '../../ui/BotonPrimario';

export function InicioCliente() {
  const { esDesktop } = useResponsive();
  const { usuario } = useSesion();
  const { categorias, cargando, error, recargar } = useCategoriasPublicas();

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={[estilos.contenido, esDesktop && estilos.contenidoDesktop]}>
          <Encabezado
            titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? 'bienvenido'}`}
            subtitulo="¿Qué necesitás arreglar hoy?"
          />
          <Texto variante="subtitulo">Servicios para tu hogar</Texto>
          {cargando ? <ActivityIndicator color={colores.marca} /> : null}
          {error ? <><Aviso tono="advertencia">{error}</Aviso><BotonPrimario titulo="Reintentar catálogo" variante="secundario" onPress={recargar} /></> : null}
          <View style={[estilos.acciones, esDesktop && estilos.accionesDesktop]}>
            {categorias.map((c) => (
              <Tarjeta
                key={c.nombre}
                relleno={espacio.base}
                style={esDesktop ? estilos.tarjetaDesktop : undefined}
              >
                <View style={{ backgroundColor: colores.marcaSuave, borderRadius: 12, padding: 12, alignSelf: 'flex-start', marginBottom: 16 }}>
                  <Ionicons name={iconoCategoria(c.nombre)} size={24} color={colores.marca} />
                </View>
                <Texto variante="cuerpoFuerte">{c.nombre}</Texto>
                <Texto variante="caption" color={colores.secundario}>
                  {desdeCategoria(c) ?? 'Tarifa a confirmar'}{c.tarifaHora !== null ? ` · Hora ${bolivianos(c.tarifaHora)}` : ''}
                </Texto>
              </Tarjeta>
            ))}
          </View>
          <Aviso tono="advertencia" titulo="Pendiente de V2">
            La solicitud real de servicio (F10–F12) se habilita con el controlador
            de orders.
          </Aviso>
        </ScrollView>
      </SafeAreaView>
    </ContenedorApp>
  );
}

const estilos = StyleSheet.create({
  seguro: { flex: 1 },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.lg,
    paddingBottom: espacio.lg,
    gap: espacio.base,
  },
  acciones: {
    gap: espacio.md,
  },
  contenidoDesktop: {
    paddingHorizontal: 0,
    paddingTop: 0,
    maxWidth: 1080,
  },
  accionesDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tarjetaDesktop: {
    flex: 1,
    minWidth: 240,
  },
});

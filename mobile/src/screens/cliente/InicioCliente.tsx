import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Texto } from '../../ui/Texto';
import { Tarjeta } from '../../ui/Tarjeta';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { useResponsive } from '../../theme/responsive';
import { useSesion } from '../../session/SesionProvider';
import { useSolicitudServicio } from '../../session/SolicitudServicioProvider';
import { colores, espacio } from '../../theme/tokens';
import { desdeCategoria, iconoCategoria } from '../publico/categorias';
import { bolivianos } from '../../ui/formato';
import { useCategoriasSolicitud } from './useCategoriasSolicitud';

export function InicioCliente() {
  const { esDesktop } = useResponsive();
  const { usuario } = useSesion();
  const { abrir } = useSolicitudServicio();
  const { categorias, cargando, error, recargar } = useCategoriasSolicitud();

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={[estilos.contenido, esDesktop && estilos.contenidoDesktop]}>
          <Encabezado
            titulo={`Hola, ${usuario?.nombre.split(' ')[0] ?? 'bienvenido'}`}
            subtitulo="¿Qué necesitás arreglar hoy?"
          />
          <BotonPrimario titulo="Solicitar un servicio" onPress={() => abrir()} />

          <Texto variante="subtitulo">Servicios para tu hogar</Texto>
          <Texto variante="caption" color={colores.secundario}>
            Tocá una categoría para empezar tu solicitud.
          </Texto>

          {cargando ? <ActivityIndicator color={colores.marca} /> : null}
          {error ? (
            <>
              <Aviso tono="advertencia">{error}</Aviso>
              <BotonPrimario titulo="Reintentar catálogo" variante="secundario" onPress={recargar} />
            </>
          ) : null}

          <View style={[estilos.acciones, esDesktop && estilos.accionesDesktop]}>
            {categorias.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Solicitar ${c.nombre}`}
                onPress={() => abrir(c.id)}
                style={({ pressed }) => [
                  esDesktop && estilos.accionDesktop,
                  pressed ? estilos.presionado : undefined,
                ]}
              >
                <Tarjeta relleno={espacio.base} style={esDesktop ? estilos.tarjetaDesktop : undefined}>
                  <View style={estilos.iconoCaja}>
                    <Ionicons name={iconoCategoria(c.nombre)} size={24} color={colores.marca} />
                  </View>
                  <Texto variante="cuerpoFuerte">{c.nombre}</Texto>
                  <Texto variante="caption" color={colores.secundario}>
                    {desdeCategoria(c) ?? 'Tarifa a confirmar'}
                    {c.tarifaHora !== null ? ` · Hora ${bolivianos(c.tarifaHora)}` : ''}
                  </Texto>
                  <View style={estilos.pedir}>
                    <Texto variante="etiqueta" color={colores.marca}>
                      Pedir servicio
                    </Texto>
                    <Ionicons name="arrow-forward" size={16} color={colores.marca} />
                  </View>
                </Tarjeta>
              </Pressable>
            ))}
          </View>

          {!cargando && !error && categorias.length === 0 ? (
            <Aviso tono="advertencia">
              No hay categorías disponibles en este momento. Probá de nuevo más tarde.
            </Aviso>
          ) : null}
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
  accionDesktop: {
    flex: 1,
    minWidth: 240,
  },
  tarjetaDesktop: {
    flex: 1,
  },
  presionado: {
    opacity: 0.75,
  },
  iconoCaja: {
    backgroundColor: colores.marcaSuave,
    borderRadius: 12,
    padding: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  pedir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: espacio.sm,
  },
});

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Texto } from '../../ui/Texto';
import { Tarjeta } from '../../ui/Tarjeta';
import { ContenedorApp } from '../../ui/ContenedorApp';
import { Encabezado } from '../../ui/Encabezado';
import { Aviso } from '../../ui/Aviso';
import { useResponsive } from '../../theme/responsive';
import { colores, espacio } from '../../theme/tokens';

const CATEGORIAS = [
  { nombre: 'Plomería', tarifa: 'Visita Bs 50 · Hora Bs 60' },
  { nombre: 'Electricidad', tarifa: 'Visita Bs 60 · Hora Bs 70' },
  { nombre: 'Climatización', tarifa: 'Visita Bs 80 · Hora Bs 90' },
];

export function InicioCliente() {
  const { esDesktop } = useResponsive();

  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <View style={[estilos.contenido, esDesktop && estilos.contenidoDesktop]}>
          <Encabezado
            titulo="Hola, María"
            subtitulo="¿Qué necesitás arreglar hoy?"
          />
          <View style={[estilos.acciones, esDesktop && estilos.accionesDesktop]}>
            {CATEGORIAS.map((c) => (
              <Tarjeta
                key={c.nombre}
                relleno={espacio.base}
                style={esDesktop ? estilos.tarjetaDesktop : undefined}
              >
                <Texto variante="cuerpoFuerte">{c.nombre}</Texto>
                <Texto variante="caption" color={colores.secundario}>
                  {c.tarifa}
                </Texto>
              </Tarjeta>
            ))}
          </View>
          <Aviso tono="advertencia" titulo="Pendiente de V2">
            La solicitud real de servicio (F10–F12) se habilita con el controlador
            de orders.
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

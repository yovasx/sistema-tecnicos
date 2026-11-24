import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colores, espacio } from '../theme/tokens';
import { Aviso } from './Aviso';
import { Chip } from './Chip';
import { ContenedorApp } from './ContenedorApp';
import { Encabezado } from './Encabezado';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

export type MotivoPendiente = 'v2' | 'sprint';

export interface PantallaPendienteProps {
  titulo: string;
  descripcion: string;
  pantallaStitch?: string;
  motivo?: MotivoPendiente;
}

/**
 * Pantalla honesta para lo que todavía no tiene backend.
 *
 * No se inventan datos ni columnas: se muestra el banner ámbar "pendiente de V2"
 * y la pantalla de Stitch que la va a implementar. El diseño completo queda
 * documentado en Stitch, aquí solo se reserva el lugar en la navegación.
 */
export function PantallaPendiente({
  titulo,
  descripcion,
  pantallaStitch,
  motivo = 'v2',
}: PantallaPendienteProps) {
  return (
    <ContenedorApp>
      <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right']}>
        <View style={estilos.contenido}>
          <Encabezado titulo={titulo} />
          <Aviso
            tono="advertencia"
            titulo={motivo === 'v2' ? 'Pendiente de V2' : 'Pendiente de este sprint'}
          >
            {descripcion}
          </Aviso>
          <Tarjeta>
            <View style={estilos.bloque}>
              <Texto variante="etiqueta" color={colores.secundario}>
                Referencia de diseño
              </Texto>
              <Texto variante="cuerpoFuerte">
                {pantallaStitch ?? 'Pantalla todavía sin diseño aprobado'}
              </Texto>
              <Texto variante="caption">
                Cuando exista la API, esta pantalla se conecta sin cambiar la navegación.
              </Texto>
            </View>
          </Tarjeta>
          <Chip texto={motivo === 'v2' ? 'Requiere migración V2' : 'Fuera del alcance actual'} />
        </View>
      </SafeAreaView>
    </ContenedorApp>
  );
}

const estilos = StyleSheet.create({
  seguro: {
    flex: 1,
  },
  contenido: {
    flex: 1,
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.lg,
    gap: espacio.base,
  },
  bloque: {
    gap: 6,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Seccion } from '../navigation/secciones';
import { useSesion } from '../session/SesionProvider';
import { Chip } from '../ui/Chip';
import { Texto } from '../ui/Texto';
import { colores, espacio, fuentes, tamanos } from '../theme/tokens';

export interface DesktopShellProps {
  secciones: Seccion[];
  /** Texto bajo la marca: "Backoffice", "Mi cuenta", "Panel técnico". */
  etiqueta: string;
}

/**
 * Shell de escritorio: sidebar 240 + topbar 64 + contenido con scroll.
 *
 * La sección activa vive en estado local; cada sección es la misma pantalla que
 * en el teléfono, sin la columna de 420 px. Así el contenido se escribe una vez.
 */
export function DesktopShell({ secciones, etiqueta }: DesktopShellProps) {
  const { usuario, cerrarSesion } = useSesion();
  const [activa, setActiva] = useState(secciones[0].clave);

  const actual = secciones.find((s) => s.clave === activa) ?? secciones[0];
  const Pantalla = actual.pantalla;

  return (
    <View style={estilos.raiz}>
      <View style={estilos.sidebar}>
        <View style={estilos.marca}>
          <Texto variante="titulo" color={colores.marca}>
            Fixly
          </Texto>
          <Texto variante="caption">{etiqueta}</Texto>
        </View>

        <ScrollView style={estilos.lista} contentContainerStyle={estilos.listaContenido}>
          {secciones.map((s) => {
            const esActiva = s.clave === activa;
            return (
              <Pressable
                key={s.clave}
                accessibilityRole="button"
                onPress={() => setActiva(s.clave)}
                style={[estilos.item, esActiva && estilos.itemActivo]}
              >
                <Ionicons
                  name={s.icono}
                  size={20}
                  color={esActiva ? colores.marca : colores.terciario}
                />
                <Texto
                  variante={esActiva ? 'etiqueta' : 'cuerpo'}
                  color={esActiva ? colores.marcaFuerte : colores.secundario}
                  numberOfLines={1}
                >
                  {s.titulo}
                </Texto>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={estilos.pie}>
          <Texto variante="caption" numberOfLines={1}>
            {usuario?.email ?? '—'}
          </Texto>
          <Chip texto={usuario?.rol ?? '—'} tono="marca" />
          <Texto onPress={cerrarSesion} style={estilos.cerrar}>
            Cerrar sesión
          </Texto>
        </View>
      </View>

      <View style={estilos.principal}>
        <View style={estilos.topbar}>
          <Texto variante="subtitulo">{actual.titulo}</Texto>
          <Chip texto={usuario?.nombre ?? '—'} tono="neutro" />
        </View>
        <ScrollView
          style={estilos.contenido}
          contentContainerStyle={estilos.contenidoContenido}
        >
          <Pantalla />
        </ScrollView>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colores.fondo,
  },
  sidebar: {
    width: 240,
    backgroundColor: colores.superficie,
    borderRightWidth: 1,
    borderRightColor: colores.linea,
    paddingVertical: espacio.lg,
  },
  marca: {
    paddingHorizontal: espacio.lg,
    marginBottom: espacio.lg,
    gap: 2,
  },
  lista: {
    flex: 1,
  },
  listaContenido: {
    gap: 2,
    paddingHorizontal: espacio.md,
    paddingBottom: espacio.base,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingHorizontal: espacio.base,
    paddingVertical: 10,
    borderRadius: 12,
  },
  itemActivo: {
    backgroundColor: colores.marcaSuave,
  },
  pie: {
    borderTopWidth: 1,
    borderTopColor: colores.linea,
    paddingHorizontal: espacio.base,
    paddingTop: espacio.md,
    gap: 6,
  },
  cerrar: {
    fontFamily: fuentes.etiqueta,
    fontSize: tamanos.pequeno,
    color: colores.peligro,
    marginTop: 4,
  },
  principal: {
    flex: 1,
  },
  topbar: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: colores.linea,
    backgroundColor: colores.superficie,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.xl,
    gap: espacio.base,
  },
  contenido: {
    flex: 1,
  },
  contenidoContenido: {
    flexGrow: 1,
    padding: espacio.xl,
    gap: espacio.lg,
  },
});

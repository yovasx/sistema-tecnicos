import { Ionicons } from '@expo/vector-icons';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Seccion } from '../navigation/secciones';
import { useSesion } from '../session/SesionProvider';
import { Chip } from '../ui/Chip';
import { Texto } from '../ui/Texto';
import { colores, espacio, fuentes, tamanos } from '../theme/tokens';
import { CambiosAdminProvider, useCambiosAdmin } from '../ui/admin/CambiosAdmin';
import { Aviso } from '../ui/Aviso';
import { BotonPrimario } from '../ui/BotonPrimario';
import { leerRutaAdmin, guardarRutaAdmin } from '../infrastructure/navigation/rutaAdmin';

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
  return <CambiosAdminProvider><ContenidoDesktop secciones={secciones} etiqueta={etiqueta} /></CambiosAdminProvider>;
}
function ContenidoDesktop({ secciones, etiqueta }: DesktopShellProps) {
  const { usuario, cerrarSesion } = useSesion();
  const [activa, setActiva] = useState(() => {
    const ruta = etiqueta === 'Backoffice' ? leerRutaAdmin().seccion : '';
    return secciones.some(s => s.clave === ruta) ? ruta : secciones[0].clave;
  });
  const { sucio, ocupado } = useCambiosAdmin();
  const [destino, setDestino] = useState<string | null>(null);
  function ir(clave: string) {
    if (etiqueta === 'Backoffice') guardarRutaAdmin(clave === 'cerrarSesion' ? '' : clave);
    if (clave === 'cerrarSesion') void cerrarSesion(); else setActiva(clave);
  }
  function navegar(clave: string) {
    if (ocupado) return;
    if (sucio) { setDestino(clave); return; }
    ir(clave);
  }

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
          {secciones.map((s, indice) => {
            const esActiva = s.clave === activa;
            return (
              <Fragment key={s.clave}>
              {s.grupo && secciones[indice - 1]?.grupo !== s.grupo ?
                <Texto variante="caption" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>{s.grupo.toUpperCase()}</Texto> : null}
              <Pressable
                key={s.clave}
                accessibilityRole="button"
                onPress={() => navegar(s.clave)}
                accessibilityState={{ selected: esActiva }}
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
              </Fragment>
            );
          })}
        </ScrollView>

        <View style={estilos.pie}>
          <Texto variante="caption" numberOfLines={1}>
            {usuario?.email ?? '—'}
          </Texto>
          <Chip texto={usuario?.rol ?? '—'} tono="marca" />
          <Texto accessibilityRole="button" onPress={() => navegar('cerrarSesion')} style={estilos.cerrar}>
            Cerrar sesión
          </Texto>
        </View>
      </View>

      <View style={estilos.principal}>
        <View style={estilos.topbar}>
          <Texto variante="subtitulo">{actual.titulo}</Texto>
          <View><Chip texto={usuario?.nombre ?? '—'} tono="neutro" /></View>
        </View>
        {destino ? <View style={{ padding: 20, gap: 12 }}>
          <Aviso tono="advertencia" titulo="Tenés cambios sin guardar">Si continuás, se perderán los datos que todavía no guardaste.</Aviso>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <BotonPrimario titulo="Seguir editando" tamano="escritorio" onPress={() => setDestino(null)} />
            <BotonPrimario titulo="Descartar y continuar" variante="secundario" tamano="escritorio"
              onPress={() => { ir(destino); setDestino(null); }} />
          </View>
        </View> : null}
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

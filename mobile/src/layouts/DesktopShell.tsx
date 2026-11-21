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
import { leerRutaAdmin, guardarRutaAdmin, guardarRutaOrdenAdmin } from '../infrastructure/navigation/rutaAdmin';
import { DestinoAdmin, NavegacionAdmin } from '../navigation/NavegacionAdmin';

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
  const [destino, setDestino] = useState<DestinoAdmin | null>(null);
  const [visita, setVisita] = useState(0);
  function ir(destino: DestinoAdmin) {
    const clave = destino.seccion;
    if (etiqueta === 'Backoffice') {
      if (clave === 'ordenes' && destino.orden) guardarRutaOrdenAdmin(destino.orden);
      else guardarRutaAdmin(clave === 'cerrarSesion' ? '' : clave, destino.usuario ?? null);
    }
    if (clave === 'cerrarSesion') void cerrarSesion();
    else { setActiva(clave); setVisita(n => n + 1); }
  }
  function navegarA(destino: DestinoAdmin) {
    if (ocupado) return;
    if (destino.seccion !== 'cerrarSesion' && !secciones.some(s => s.clave === destino.seccion)) return;
    if (sucio) { setDestino(destino); return; }
    ir(destino);
  }
  function navegar(clave: string) { navegarA({ seccion: clave }); }

  const actual = secciones.find((s) => s.clave === activa) ?? secciones[0];
  const Pantalla = actual.pantalla;

  return (
    <NavegacionAdmin.Provider value={navegarA}>
    <View style={estilos.raiz}>
      <View style={estilos.sidebar}>
        <View style={estilos.marca}>
          <Texto variante="titulo" color={colores.marca}>
            Fixly
          </Texto>
          <Texto variante="caption">{etiqueta}</Texto>
        </View>

        <ScrollView style={estilos.lista} contentContainerStyle={estilos.listaContenido}>
          {secciones.filter(s => s.clave !== 'perfil').map((s, indice, lista) => {
            const esActiva = s.clave === activa;
            return (
              <Fragment key={s.clave}>
              {s.grupo && lista[indice - 1]?.grupo !== s.grupo ?
                <Texto variante="caption" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>{s.grupo.toUpperCase()}</Texto> : null}
              <Pressable
                key={s.clave}
                accessibilityRole="button"
                onPress={() => navegar(s.clave)}
                accessibilityState={{ selected: esActiva }}
                aria-current={esActiva ? 'page' : undefined}
                style={[estilos.item, esActiva && estilos.itemActivo]}
              >
                <Ionicons
                  name={s.icono}
                  size={20}
                  color={esActiva ? colores.marca : colores.terciario}
                />
                <View style={{ flex: 1, gap: 2 }}>
                <Texto
                  variante={esActiva ? 'etiqueta' : 'cuerpo'}
                  color={esActiva ? colores.marcaFuerte : colores.secundario}
                  numberOfLines={1}
                >
                  {s.titulo}
                </Texto>
                {s.pendiente ? <Texto variante="caption" color={colores.terciario}>Próximamente</Texto> : null}
                </View>
              </Pressable>
              </Fragment>
            );
          })}
        </ScrollView>

        <View style={estilos.pie}>
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir Mi cuenta"
            accessibilityState={{ selected: activa === 'perfil' }}
            onPress={() => navegar('perfil')} style={[estilos.item, activa === 'perfil' && estilos.itemActivo]}>
            <Ionicons name="person-circle-outline" size={22} color={colores.marca} />
            <Texto variante="etiqueta" color={colores.marca}>Mi cuenta</Texto>
          </Pressable>
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
          <Pressable accessibilityRole="button"
            accessibilityLabel={`Cuenta de sesión: ${usuario?.nombre ?? '—'}. Abrir mi perfil`}
            onPress={() => navegar('perfil')} style={estilos.identidadSesion}>
            <View style={estilos.avatarSesion}>
              <Ionicons name="person-outline" size={18} color={colores.marca} />
            </View>
            <View style={{ maxWidth: 230 }}>
              <Texto variante="etiqueta" numberOfLines={1}>{usuario?.nombre ?? '—'}</Texto>
              <Texto variante="caption">{usuario?.rol === 'administrador' ? 'Administrador · Mi perfil' :
                usuario?.rol === 'tecnico' ? 'Técnico · Mi perfil' : 'Cliente · Mi perfil'}</Texto>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colores.terciario} />
          </Pressable>
        </View>
        {destino ? <View style={{ padding: 20, gap: 12 }}>
          <Aviso tono="advertencia" titulo="Tienes cambios sin guardar">Si continúas, se perderán los datos que todavía no guardaste.</Aviso>
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
          <Pantalla key={`${usuario?.id}:${activa}:${visita}`} />
        </ScrollView>
      </View>
    </View>
    </NavegacionAdmin.Provider>
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
  identidadSesion: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: 10 },
  avatarSesion: { width: 34, height: 34, borderRadius: 17, backgroundColor: colores.marcaSuave,
    alignItems: 'center', justifyContent: 'center' },
  contenido: {
    flex: 1,
  },
  contenidoContenido: {
    flexGrow: 1,
    padding: espacio.xl,
    gap: espacio.lg,
  },
});

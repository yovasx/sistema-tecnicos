import { ComponentRef, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Chip } from '../../ui/Chip';
import { Texto } from '../../ui/Texto';
import { bolivianos } from '../../ui/formato';
import { colores, espacio, radio } from '../../theme/tokens';
import { desdeCategoria, iconoCategoria } from './categorias';
import { useCategoriasPublicas } from './useCategoriasPublicas';

export interface LandingPublicaScreenProps {
  /** Lleva al login de escritorio (W63). */
  onEntrar: () => void;
  /** Abre el selector de cuenta para registrarse. */
  onCrearCuenta: () => void;
}

const PASOS = [
  { numero: '1', titulo: 'Elegís tu problema', detalle: 'Contás qué pasa y en qué zona estás.' },
  {
    numero: '2',
    titulo: 'Cotización y técnico asignado',
    detalle: 'Ves el precio estimado antes de confirmar.',
  },
  {
    numero: '3',
    titulo: 'Pagás con QR Simple al finalizar',
    detalle: 'El trabajo termina con garantía escrita.',
  },
];

const ZONAS = ['Sopocachi', 'San Miguel', 'Calacoto'];

const SOPORTE = 'soporte@fixly.bo';

/**
 * W62 · Landing pública de escritorio.
 *
 * Es la cara del producto para quien todavía no tiene cuenta: explica el
 * servicio, muestra las tarifas base reales del catálogo y lleva al registro o
 * al login (W63). En el teléfono se usa una bienvenida compacta, no esta
 * landing.
 */
export function LandingPublicaScreen({ onEntrar, onCrearCuenta }: LandingPublicaScreenProps) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [yCategorias, setYCategorias] = useState(0);
  const [yComoFunciona, setYComoFunciona] = useState(0);
  const { categorias, cargando, error, recargar } = useCategoriasPublicas();

  const irA = (y: number) => scroll.current?.scrollTo({ y, animated: true });

  return (
    <View style={estilos.raiz}>
      <View style={estilos.header}>
        <View style={estilos.marca}>
          <View style={estilos.logo}>
            <Ionicons name="build" size={18} color={colores.superficie} />
          </View>
          <Texto variante="titulo" color={colores.marca}>
            Fixly
          </Texto>
          <View style={estilos.separadorMarca} />
          <Texto variante="caption" color={colores.secundario}>
            La Paz
          </Texto>
        </View>

        <View style={estilos.nav}>
          <Texto
            variante="etiqueta"
            color={colores.secundario}
            onPress={() => irA(yComoFunciona)}
            accessibilityRole="button"
          >
            Cómo funciona
          </Texto>
          <Texto
            variante="etiqueta"
            color={colores.secundario}
            onPress={() => irA(yCategorias)}
            accessibilityRole="button"
          >
            Categorías
          </Texto>
          <Texto
            variante="etiqueta"
            color={colores.secundario}
            onPress={onEntrar}
            accessibilityRole="button"
          >
            Para técnicos
          </Texto>
          <Texto
            variante="etiqueta"
            color={colores.secundario}
            onPress={() => void Linking.openURL(`mailto:${SOPORTE}`)}
            accessibilityRole="link"
          >
            Ayuda
          </Texto>
        </View>

        <View style={estilos.accionesHeader}>
          <BotonPrimario
            titulo="Ya tengo cuenta"
            variante="secundario"
            tamano="escritorio"
            onPress={onEntrar}
          />
          <BotonPrimario
            titulo="Crear cuenta"
            tamano="escritorio"
            onPress={onCrearCuenta}
          />
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={estilos.scroll}
        contentContainerStyle={estilos.scrollContenido}
      >
        <View style={estilos.hero}>
          <View style={estilos.heroTexto}>
            <Chip
              tono="marca"
              texto="Servicios verificados en La Paz · Valle Central y Zona Sur"
            />
            <Texto style={estilos.titular}>
              Un técnico verificado,{'\n'}en tu puerta en minutos.
            </Texto>
            <Texto variante="subtitulo" color={colores.secundario} style={estilos.bajada}>
              Servicios a domicilio en La Paz, con precio estimado antes de confirmar.
              Profesionales auditados con antecedentes, seguro y garantía escrita.
            </Texto>

            <View style={estilos.ctaHero}>
              <BotonPrimario
                titulo="Crear cuenta"
                tamano="escritorio"
                onPress={onCrearCuenta}
              />
              <BotonPrimario
                titulo="Ver tarifas base"
                variante="secundario"
                tamano="escritorio"
                onPress={() => irA(yCategorias)}
              />
            </View>

            <View style={estilos.beneficios}>
              {['Técnicos validados', 'Precio antes de reparar', 'Seguimiento en vivo'].map(
                (b) => (
                  <View key={b} style={estilos.beneficio}>
                    <Ionicons name="checkmark-circle" size={16} color={colores.exito} />
                    <Texto variante="caption">{b}</Texto>
                  </View>
                ),
              )}
            </View>
          </View>

          <View style={estilos.heroTarjeta}>
            <View style={estilos.heroTarjetaArriba}>
              <Ionicons name="shield-checkmark" size={18} color={colores.marca} />
              <Texto variante="etiqueta" color={colores.marcaFuerte}>
                Servicio verificado
              </Texto>
            </View>
            <Texto variante="subtitulo">Identidad y antecedentes revisados</Texto>
            <Texto variante="caption" color={colores.secundario}>
              El técnico que llega a tu casa pasó la validación de Fixly antes de
              recibir órdenes.
            </Texto>
            <View style={estilos.lineaHero} />
            <Texto variante="caption" color={colores.secundario}>
              Cobertura activa en:
            </Texto>
            <View style={estilos.puntos}>
              {ZONAS.map((zona) => (
                <Chip key={zona} texto={zona} />
              ))}
            </View>
          </View>
        </View>

        <View
          style={estilos.bloque}
          onLayout={(e) => setYCategorias(e.nativeEvent.layout.y)}
        >
          <Texto variante="titulo">Servicios por categoría</Texto>
          <Texto variante="caption" color={colores.secundario}>
            Tarifas base publicadas por Fixly. El precio final se confirma antes de
            empezar.
          </Texto>

          {cargando ? (
            <View style={estilos.cargandoCategorias}>
              <ActivityIndicator color={colores.marca} />
            </View>
          ) : null}

          {!cargando && error ? (
            <View style={estilos.errorCategorias}>
              <Aviso tono="advertencia" titulo="No pudimos cargar las tarifas">
                {error}
              </Aviso>
              <Texto
                variante="etiqueta"
                color={colores.marca}
                onPress={recargar}
                accessibilityRole="button"
              >
                Reintentar
              </Texto>
            </View>
          ) : null}

          {!cargando && !error ? (
            <View style={estilos.grillaCategorias}>
              {categorias.map((categoria) => (
                <View key={categoria.nombre} style={estilos.tarjetaCategoria}>
                  <View style={estilos.iconoCategoria}>
                    <Ionicons
                      name={iconoCategoria(categoria.nombre)}
                      size={20}
                      color={colores.marca}
                    />
                  </View>
                  <Texto variante="subtitulo">{categoria.nombre}</Texto>
                  <Texto
                    variante="caption"
                    color={colores.secundario}
                    style={estilos.detalle}
                  >
                    {categoria.descripcion ?? 'Servicio a domicilio con técnico validado.'}
                  </Texto>
                  <View style={estilos.pieCategoria}>
                    <Texto variante="etiqueta">
                      {desdeCategoria(categoria) ?? 'Tarifa a confirmar'}
                    </Texto>
                    {categoria.tarifaHora !== null ? (
                      <Texto variante="caption" color={colores.terciario}>
                        Hora {bolivianos(categoria.tarifaHora)}
                      </Texto>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View
          style={estilos.bloque}
          onLayout={(e) => setYComoFunciona(e.nativeEvent.layout.y)}
        >
          <Texto variante="titulo">Cómo funciona</Texto>
          <View style={estilos.pasos}>
            {PASOS.map((p) => (
              <View key={p.numero} style={estilos.paso}>
                <View style={estilos.numero}>
                  <Texto variante="etiqueta" color={colores.marcaFuerte}>
                    {p.numero}
                  </Texto>
                </View>
                <Texto variante="cuerpoFuerte">{p.titulo}</Texto>
                <Texto variante="caption" color={colores.secundario}>
                  {p.detalle}
                </Texto>
              </View>
            ))}
          </View>
        </View>

        <View style={estilos.garantia}>
          <Ionicons name="shield-checkmark" size={24} color={colores.exito} />
          <View style={estilos.garantiaTexto}>
            <Texto variante="cuerpoFuerte">Garantía de satisfacción</Texto>
            <Texto variante="caption" color={colores.secundario}>
              Cada servicio incluye garantía escrita y respaldo de Fixly Bolivia.
            </Texto>
          </View>
          <BotonPrimario
            titulo="Entrar a mi cuenta"
            tamano="escritorio"
            onPress={onEntrar}
          />
        </View>

        <View style={estilos.footer}>
          <Texto
            variante="caption"
            color={colores.terciario}
            onPress={() => void Linking.openURL(`mailto:${SOPORTE}`)}
            accessibilityRole="link"
          >
            Fixly Bolivia S.R.L. · La Paz, Bolivia · Soporte: {SOPORTE}
          </Texto>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    backgroundColor: colores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: colores.linea,
    gap: espacio.lg,
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colores.marca,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separadorMarca: {
    width: 1,
    height: 16,
    backgroundColor: colores.lineaFuerte,
    marginHorizontal: 2,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.lg,
  },
  accionesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContenido: {
    paddingHorizontal: 48,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 56,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
  },
  heroTexto: {
    flex: 1.2,
    gap: espacio.lg,
  },
  titular: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1,
    color: colores.tinta,
  },
  bajada: {
    maxWidth: 560,
    lineHeight: 26,
  },
  ctaHero: {
    flexDirection: 'row',
    gap: espacio.md,
  },
  beneficios: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.lg,
  },
  beneficio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTarjeta: {
    flex: 0.8,
    maxWidth: 380,
    backgroundColor: colores.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.lg,
    gap: espacio.sm,
  },
  heroTarjetaArriba: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineaHero: {
    height: 1,
    backgroundColor: colores.linea,
    marginVertical: espacio.sm,
  },
  puntos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  bloque: {
    gap: espacio.base,
  },
  cargandoCategorias: {
    paddingVertical: espacio.xxl,
    alignItems: 'center',
  },
  errorCategorias: {
    gap: espacio.sm,
    alignItems: 'flex-start',
  },
  grillaCategorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio.base,
    marginTop: espacio.sm,
  },
  tarjetaCategoria: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: colores.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.lg,
    gap: espacio.sm,
  },
  iconoCategoria: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colores.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detalle: {
    minHeight: 34,
  },
  pieCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio.sm,
    marginTop: espacio.sm,
  },
  pasos: {
    flexDirection: 'row',
    gap: espacio.base,
    marginTop: espacio.sm,
  },
  paso: {
    flex: 1,
    backgroundColor: colores.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
    padding: espacio.lg,
    gap: 6,
  },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colores.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  garantia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.base,
    backgroundColor: colores.exitoSuave,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: '#A6F4C5',
    padding: espacio.lg,
  },
  garantiaTexto: {
    flex: 1,
    gap: 2,
  },
  footer: {
    alignItems: 'center',
    paddingTop: espacio.base,
    borderTopWidth: 1,
    borderTopColor: colores.linea,
  },
});

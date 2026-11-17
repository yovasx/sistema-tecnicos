import { ComponentRef, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Chip } from '../../ui/Chip';
import { Texto } from '../../ui/Texto';
import { colores, espacio, radio } from '../../theme/tokens';

export interface LandingPublicaScreenProps {
  /** Lleva al login de escritorio (W63). */
  onEntrar: () => void;
}

const CATEGORIAS = [
  {
    icono: 'water' as const,
    nombre: 'Plomería',
    detalle: 'Fugas, grifería e instalaciones sanitarias',
    desde: 'Bs 50',
  },
  {
    icono: 'flash' as const,
    nombre: 'Electricidad',
    detalle: 'Cortocircuitos, tableros y cableado',
    desde: 'Bs 60',
  },
  {
    icono: 'thermometer' as const,
    nombre: 'Climatización y gas',
    detalle: 'Calefones, estufas e instalaciones',
    desde: 'Bs 80',
  },
];

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

/**
 * W62 · Landing pública de escritorio.
 *
 * Es la cara del producto para quien todavía no tiene cuenta: explica el
 * servicio, muestra las tarifas base reales y lleva al login (W63). En el
 * teléfono no se muestra: ahí la app abre directo en el login (F03).
 */
export function LandingPublicaScreen({ onEntrar }: LandingPublicaScreenProps) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [yCategorias, setYCategorias] = useState(0);

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
          <Texto variante="etiqueta" color={colores.secundario}>
            Cómo funciona
          </Texto>
          <Texto
            variante="etiqueta"
            color={colores.secundario}
            onPress={() => scroll.current?.scrollTo({ y: yCategorias, animated: true })}
          >
            Categorías
          </Texto>
          <Texto variante="etiqueta" color={colores.secundario}>
            Para técnicos
          </Texto>
          <Texto variante="etiqueta" color={colores.secundario}>
            Ayuda
          </Texto>
        </View>

        <View style={estilos.accionesHeader}>
          <BotonPrimario
            titulo="Soy técnico"
            variante="secundario"
            tamano="escritorio"
            onPress={onEntrar}
          />
          <BotonPrimario
            titulo="Solicitar un técnico"
            tamano="escritorio"
            onPress={onEntrar}
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
                titulo="Pedir técnico ahora"
                tamano="escritorio"
                onPress={onEntrar}
              />
              <BotonPrimario
                titulo="Ver tarifas base"
                variante="secundario"
                tamano="escritorio"
                onPress={() => scroll.current?.scrollTo({ y: yCategorias, animated: true })}
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
              <Ionicons name="navigate" size={18} color={colores.marca} />
              <Texto variante="etiqueta" color={colores.marcaFuerte}>
                GPS activo
              </Texto>
            </View>
            <Texto variante="caption" color={colores.secundario}>
              Tiempo promedio de arribo
            </Texto>
            <Texto style={estilos.arribo}>18 min</Texto>
            <View style={estilos.lineaHero} />
            <Texto variante="caption" color={colores.secundario}>
              Cobertura activa en Sopocachi, San Miguel y Calacoto.
            </Texto>
            <View style={estilos.puntos}>
              {['Sopocachi', 'San Miguel', 'Calacoto'].map((z) => (
                <Chip key={z} texto={z} />
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
            Tarifas base publicadas. El precio final se confirma antes de empezar.
          </Texto>
          <View style={estilos.grillaCategorias}>
            {CATEGORIAS.map((c) => (
              <View key={c.nombre} style={estilos.tarjetaCategoria}>
                <View style={estilos.iconoCategoria}>
                  <Ionicons name={c.icono} size={20} color={colores.marca} />
                </View>
                <Texto variante="subtitulo">{c.nombre}</Texto>
                <Texto variante="caption" color={colores.secundario} style={estilos.detalle}>
                  {c.detalle}
                </Texto>
                <View style={estilos.pieCategoria}>
                  <Texto variante="etiqueta">Desde {c.desde}</Texto>
                  <Texto
                    variante="etiqueta"
                    color={colores.marca}
                    onPress={onEntrar}
                  >
                    Ver tarifas
                  </Texto>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={estilos.bloque}>
          <Texto variante="titulo">Proceso simple</Texto>
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
          <Texto variante="caption" color={colores.terciario}>
            Fixly Bolivia S.R.L. · La Paz, Bolivia · Soporte: soporte@fixly.bo
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
  arribo: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 40,
    lineHeight: 46,
    color: colores.tinta,
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
  grillaCategorias: {
    flexDirection: 'row',
    gap: espacio.base,
    marginTop: espacio.sm,
  },
  tarjetaCategoria: {
    flex: 1,
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

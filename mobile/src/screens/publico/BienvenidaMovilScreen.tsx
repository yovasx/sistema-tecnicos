import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { colores, espacio, radio } from '../../theme/tokens';
import { CategoriaPublica } from '../../domain/models/Publico';
import { desdeCategoria, iconoCategoria } from './categorias';
import { useCategoriasPublicas } from './useCategoriasPublicas';

export interface BienvenidaMovilScreenProps {
  onCrearCuenta: () => void;
  onEntrar: () => void;
  /** Los técnicos existentes entran por login; el alta completa es posterior. */
  onSoyTecnico: () => void;
  onActivarCuenta: () => void;
}

/**
 * F01 · Bienvenida del teléfono.
 *
 * Es la primera pantalla para quien no tiene sesión: explica en un solo
 * viewport qué hace Fixly, muestra las tarifas base reales y ofrece crear
 * cuenta o entrar. No es la landing de escritorio achicada.
 */
export function BienvenidaMovilScreen({
  onCrearCuenta,
  onEntrar,
  onSoyTecnico,
  onActivarCuenta,
}: BienvenidaMovilScreenProps) {
  const { categorias, cargando, error, recargar } = useCategoriasPublicas();

  return (
    <SafeAreaView style={estilos.seguro} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.header}>
          <View style={estilos.marca}>
            <View style={estilos.logo}>
              <Ionicons name="build" size={16} color={colores.superficie} />
            </View>
            <Texto variante="titulo" color={colores.marca}>
              Fixly
            </Texto>
            <View style={estilos.separador} />
            <Texto variante="caption" color={colores.secundario}>
              La Paz
            </Texto>
          </View>
          <Texto
            variante="etiqueta"
            color={colores.marca}
            onPress={onEntrar}
            accessibilityRole="button"
          >
            Entrar
          </Texto>
        </View>

        <View style={estilos.hero}>
          <Texto variante="caption" color={colores.secundario}>
            Servicios a domicilio en La Paz
          </Texto>
          <Texto style={estilos.titular}>Atención técnica para tu hogar y empresa</Texto>
          <Texto variante="cuerpo" color={colores.secundario}>
            Solicita atención a nuestra empresa, autoriza el trabajo y conserva su historial.
          </Texto>
        </View>

        <View style={estilos.categorias}>
          <View style={estilos.categoriasTitulo}>
            <Texto variante="etiqueta">Servicios más pedidos</Texto>
            <Texto variante="caption" color={colores.terciario}>
              Tarifas base
            </Texto>
          </View>

          <View style={estilos.tarjetaCategorias}>
            {cargando ? (
              <View style={estilos.cargando}>
                <ActivityIndicator color={colores.marca} />
              </View>
            ) : null}

            {!cargando && error ? (
              <Pressable
                accessibilityRole="button"
                onPress={recargar}
                style={estilos.errorCategorias}
              >
                <Ionicons name="cloud-offline-outline" size={18} color={colores.advertencia} />
                <Texto variante="caption" color={colores.advertencia} style={estilos.errorTexto}>
                  {error} Selecciona para reintentar.
                </Texto>
              </Pressable>
            ) : null}

            {!cargando && !error
              ? categorias.map((categoria, indice) => (
                  <FilaCategoria
                    key={categoria.nombre}
                    categoria={categoria}
                    ultima={indice === categorias.length - 1}
                  />
                ))
              : null}
          </View>
        </View>

        <View style={estilos.confianza}>
          <Ionicons name="shield-checkmark" size={16} color={colores.exito} />
          <Texto variante="caption" color={colores.secundario}>
            Personal habilitado por la empresa · autorización antes de reparar
          </Texto>
        </View>

        <View style={estilos.acciones}>
          <BotonPrimario titulo="Crear cuenta" onPress={onCrearCuenta} />
          <BotonPrimario
            titulo="Ya tengo cuenta"
            variante="secundario"
            onPress={onEntrar}
          />
          <Texto
            variante="caption"
            color={colores.secundario}
            centrado
            onPress={onSoyTecnico}
            accessibilityRole="button"
            style={estilos.soyTecnico}
          >
            Activar invitación de personal técnico
          </Texto>
          <Texto variante="caption" color={colores.secundario} centrado
            accessibilityRole="button" onPress={onActivarCuenta} style={estilos.soyTecnico}>
            Activar cuenta invitada
          </Texto>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilaCategoria({
  categoria,
  ultima,
}: {
  categoria: CategoriaPublica;
  ultima: boolean;
}) {
  const desde = desdeCategoria(categoria);

  return (
    <View style={[estilos.fila, !ultima ? estilos.filaBorde : null]}>
      <View style={estilos.icono}>
        <Ionicons name={iconoCategoria(categoria.nombre)} size={18} color={colores.marca} />
      </View>
      <View style={estilos.filaTexto}>
        <Texto variante="etiqueta" numberOfLines={1}>
          {categoria.nombre}
        </Texto>
        {categoria.descripcion ? (
          <Texto variante="caption" color={colores.terciario} numberOfLines={1}>
            {categoria.descripcion}
          </Texto>
        ) : null}
      </View>
      {desde ? (
        <Texto variante="caption" color={colores.tinta} style={estilos.precio}>
          {desde}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  seguro: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  contenido: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: espacio.lg,
    paddingTop: espacio.base,
    paddingBottom: espacio.lg,
    gap: espacio.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
  },
  logo: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colores.marca,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separador: {
    width: 1,
    height: 14,
    backgroundColor: colores.lineaFuerte,
    marginHorizontal: 2,
  },
  hero: {
    gap: espacio.sm,
    marginTop: 16,
    paddingVertical: 12,
  },
  titular: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: colores.tinta,
  },
  categorias: {
    gap: espacio.sm,
  },
  categoriasTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tarjetaCategorias: {
    backgroundColor: colores.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: colores.linea,
    overflow: 'hidden',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingHorizontal: espacio.base,
    paddingVertical: espacio.md,
  },
  filaBorde: {
    borderBottomWidth: 1,
    borderBottomColor: colores.linea,
  },
  icono: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colores.marcaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaTexto: {
    flex: 1,
    gap: 1,
  },
  precio: {
    fontFamily: 'Inter_600SemiBold',
  },
  cargando: {
    paddingVertical: espacio.xl,
    alignItems: 'center',
  },
  errorCategorias: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    padding: espacio.base,
  },
  errorTexto: {
    flex: 1,
    lineHeight: 18,
  },
  confianza: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acciones: {
    marginTop: 'auto',
    gap: espacio.sm,
  },
  soyTecnico: {
    paddingVertical: espacio.sm,
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { CategoriaAdmin, GuardarCategoriaInput } from '../../domain/models/Admin';
import { adminRepository as repo } from '../../infrastructure/di';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { bolivianos } from '../../ui/formato';
import { colores, espacio, radio } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

type Filtro = 'todas' | 'activas' | 'inactivas';

const FILTROS: [Filtro, string][] = [
  ['todas', 'Todas'],
  ['activas', 'Activas'],
  ['inactivas', 'Inactivas'],
];

interface Formulario {
  nombre: string;
  descripcion: string;
  tarifaVisita: string;
  tarifaHora: string;
  recargo: string;
  comision: string;
  activa: boolean;
}

const FORMULARIO_NUEVO: Formulario = {
  nombre: '',
  descripcion: '',
  tarifaVisita: '',
  tarifaHora: '',
  recargo: '0',
  comision: '0',
  activa: true,
};

/** Acepta "50", "50.5" o "50,50"; devuelve null si no es un número. */
function monto(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

function aFormulario(c: CategoriaAdmin): Formulario {
  return {
    nombre: c.nombre,
    descripcion: c.descripcion ?? '',
    tarifaVisita: c.tarifaVisita === null ? '' : String(c.tarifaVisita),
    tarifaHora: c.tarifaHora === null ? '' : String(c.tarifaHora),
    recargo: c.recargoUrgenciaPct === null ? '' : String(c.recargoUrgenciaPct),
    comision: c.comisionPct === null ? '0' : String(c.comisionPct),
    activa: c.activa,
  };
}

/**
 * W52 · Catálogo: lista de categorías a la izquierda y editor con vista previa
 * a la derecha. Cada guardado llama una sola vez al backend, que versiona
 * tarifa y comisión sin tocar importes históricos.
 */
export function CatalogoAdminScreen() {
  const { esDesktop, ancho } = useResponsive();
  const dosColumnas = esDesktop && ancho >= 1280;

  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [seleccion, setSeleccion] = useState<CategoriaAdmin | null>(null);
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState<Formulario>(FORMULARIO_NUEVO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);
  const guardando = useRef(false);

  const editando = nueva || seleccion !== null;

  const cargar = useCallback(async () => {
    setError('');
    setCargando(true);
    try {
      setCategorias(await repo.categorias());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cargar el catálogo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrir(c: CategoriaAdmin) {
    setSeleccion(c);
    setNueva(false);
    setForm(aFormulario(c));
    setErrores({});
    setError('');
    setMensaje('');
    setConfirmarDesactivar(false);
  }

  function abrirNueva() {
    setSeleccion(null);
    setNueva(true);
    setForm(FORMULARIO_NUEVO);
    setErrores({});
    setError('');
    setMensaje('');
    setConfirmarDesactivar(false);
  }

  function cerrarEditor() {
    setSeleccion(null);
    setNueva(false);
    setErrores({});
    setConfirmarDesactivar(false);
  }

  function cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: '' }));
    setConfirmarDesactivar(false);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    const nombre = form.nombre.trim();
    if (nombre.length < 2 || nombre.length > 80) {
      e.nombre = 'El nombre debe tener entre 2 y 80 caracteres.';
    }
    if (form.descripcion.trim().length > 500) {
      e.descripcion = 'La descripción no puede superar los 500 caracteres.';
    }
    const visita = monto(form.tarifaVisita);
    if (visita === null || visita > 99999999.99) {
      e.tarifaVisita = 'Ingresa de 0 a 99.999.999,99, con hasta dos decimales.';
    }
    if (form.tarifaHora.trim()) {
      const hora = monto(form.tarifaHora);
      if (hora === null || hora > 99999999.99) {
        e.tarifaHora = 'Ingresa de 0 a 99.999.999,99 con hasta dos decimales, o déjalo vacío.';
      }
    }
    const recargo = monto(form.recargo);
    if (recargo === null || recargo < 0 || recargo > 100) {
      e.recargo = 'Ingresa un porcentaje entre 0 y 100.';
    }
    const comision = monto(form.comision);
    if (comision === null || comision < 0 || comision > 100) {
      e.comision = 'Ingresa un porcentaje entre 0 y 100.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (guardando.current || !validar()) return;

    // Desactivar exige una confirmación explícita: oculta la categoría al público.
    if (seleccion?.activa && !form.activa && !confirmarDesactivar) {
      setConfirmarDesactivar(true);
      return;
    }

    const input: GuardarCategoriaInput = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      activa: form.activa,
      tarifaVisita: monto(form.tarifaVisita)!,
      tarifaHora: monto(form.tarifaHora),
      recargoUrgenciaPct: monto(form.recargo)!,
      moneda: 'BOB',
      comisionPct: monto(form.comision)!,
    };

    guardando.current = true;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const guardada = nueva
        ? await repo.crearCategoria(input)
        : await repo.actualizarCategoria(seleccion!.id, input);
      // La respuesta ya contiene la categoría persistida. No hacer otra lectura:
      // si fallara, no debe confundirse con un fallo del guardado y duplicar el alta.
      setCategorias((prev) => nueva
        ? [...prev, guardada]
        : prev.map((c) => c.id === guardada.id ? guardada : c));
      setMensaje(
        nueva
          ? `Categoría "${guardada.nombre}" creada con su tarifa vigente.`
          : `Cambios guardados en "${guardada.nombre}".`,
      );
      setSeleccion(guardada);
      setNueva(false);
      setForm(aFormulario(guardada));
      setConfirmarDesactivar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar la categoría.');
    } finally {
      guardando.current = false;
      setOcupado(false);
    }
  }

  const termino = busqueda.trim().toLowerCase();
  const visibles = categorias.filter((c) => {
    if (filtro === 'activas' && !c.activa) return false;
    if (filtro === 'inactivas' && c.activa) return false;
    if (!termino) return true;
    return `${c.nombre} ${c.descripcion ?? ''}`.toLowerCase().includes(termino);
  });

  const visita = monto(form.tarifaVisita);
  const recargo = monto(form.recargo);
  const recargoMonto = visita !== null && recargo !== null ? (visita * recargo) / 100 : null;
  const total = visita !== null && recargoMonto !== null ? visita + recargoMonto : null;

  return (
    <View style={s.raiz}>
      <Encabezado
        titulo="Catálogo de servicios"
        subtitulo="Servicios y tarifas de referencia de la empresa. Cada cambio queda auditado y versionado por fecha."
        derecha={
          <BotonPrimario
            titulo="Nueva categoría"
            tamano="escritorio"
            deshabilitado={ocupado}
            onPress={abrirNueva}
          />
        }
      />

      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
      <View style={s.filtros}>
        <BotonPrimario titulo="Actualizar catálogo" variante="secundario" tamano="escritorio"
          deshabilitado={ocupado || cargando} onPress={() => void cargar()} />
      </View>

      <View style={[s.columnas, dosColumnas && s.columnasDesktop]}>
        <View style={[s.lista, dosColumnas && { flex: 3 }]}>
          <CampoTexto
            etiqueta="Buscar categoría"
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Nombre o descripción"
            autoCapitalize="none"
          />
          <View style={s.filtros}>
            {FILTROS.map(([valor, titulo]) => (
              <Pressable
                key={valor}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar ${titulo.toLowerCase()}`}
                accessibilityState={{ selected: filtro === valor }}
                onPress={() => setFiltro(valor)}
                style={[s.filtro, filtro === valor && s.filtroActivo]}
              >
                <Texto variante="etiqueta" color={filtro === valor ? colores.marcaFuerte : colores.secundario}>
                  {titulo}
                </Texto>
              </Pressable>
            ))}
          </View>
          <Texto variante="caption">
            {visibles.length} de {categorias.length} categorías ·{' '}
            {categorias.filter((c) => c.activa).length} activas
          </Texto>

          {cargando ? <ActivityIndicator color={colores.marca} size="large" /> : null}
          {!cargando && visibles.length === 0 ? (
            <Aviso titulo="Sin resultados">
              No hay categorías con ese criterio. Intenta otra búsqueda o crea una categoría nueva.
            </Aviso>
          ) : null}

          {visibles.map((c) => {
            const activaFila = !nueva && seleccion?.id === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Editar categoría ${c.nombre}`}
                accessibilityState={{ selected: activaFila }}
                disabled={ocupado}
                onPress={() => abrir(c)}
                style={[s.fila, activaFila && s.filaActiva]}
              >
                <View style={s.filaTextos}>
                  <View style={s.filaTitulo}>
                    <Texto variante="cuerpoFuerte" numberOfLines={1} style={s.nombre}>
                      {c.nombre}
                    </Texto>
                    <Chip texto={c.activa ? 'Activa' : 'Inactiva'} tono={c.activa ? 'exito' : 'neutro'} />
                  </View>
                  <Texto variante="caption" numberOfLines={2}>
                    {c.descripcion ?? 'Sin descripción'}
                  </Texto>
                  <Texto variante="caption">
                    Visita {bolivianos(c.tarifaVisita)} · Vigente desde{' '}
                    {c.tarifaVigenteDesde ?? '—'}
                  </Texto>
                </View>
                <Texto variante="etiqueta" color={colores.marca}>
                  Editar
                </Texto>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.editor, dosColumnas && { flex: 2 }]}>
          {editando ? (
            <Tarjeta style={s.tarjeta}>
              <Texto variante="subtitulo">{nueva ? 'Nueva categoría' : seleccion!.nombre}</Texto>
              {!nueva ? (
                <View style={s.filtros}>
                  <Chip texto={seleccion!.activa ? 'Activa' : 'Inactiva'} tono={seleccion!.activa ? 'exito' : 'neutro'} />
                  <Texto variante="caption">
                    Tarifa vigente desde {seleccion!.tarifaVigenteDesde ?? '—'}
                  </Texto>
                </View>
              ) : null}

              <CampoTexto
                etiqueta="Nombre"
                value={form.nombre}
                onChangeText={(v) => cambiar('nombre', v)}
                error={errores.nombre}
                maxLength={80}
                editable={!ocupado}
                placeholder="Ej.: Plomería"
              />
              <CampoTexto
                etiqueta="Descripción"
                value={form.descripcion}
                onChangeText={(v) => cambiar('descripcion', v)}
                error={errores.descripcion}
                maxLength={500}
                editable={!ocupado}
                multiline
                numberOfLines={3}
                placeholder="Qué trabajos cubre esta categoría"
              />
              <CampoTexto
                etiqueta="Tarifa de visita (Bs)"
                value={form.tarifaVisita}
                onChangeText={(v) => cambiar('tarifaVisita', v)}
                error={errores.tarifaVisita}
                editable={!ocupado}
                keyboardType="decimal-pad"
                placeholder="50,00"
              />
              <CampoTexto
                etiqueta="Tarifa por hora (Bs, opcional)"
                value={form.tarifaHora}
                onChangeText={(v) => cambiar('tarifaHora', v)}
                error={errores.tarifaHora}
                editable={!ocupado}
                keyboardType="decimal-pad"
                placeholder="80,00"
              />
              <CampoTexto
                etiqueta="Recargo de urgencia (%)"
                value={form.recargo}
                onChangeText={(v) => cambiar('recargo', v)}
                error={errores.recargo}
                editable={!ocupado}
                keyboardType="decimal-pad"
                placeholder="30"
              />
              <Texto variante="caption">
                Moneda: BOB (bolivianos). Son referencias: el importe del trabajo se autoriza mediante cotización.
              </Texto>

              <View style={s.interruptor}>
                <View style={s.interruptorTextos}>
                  <Texto variante="etiqueta">Categoría activa</Texto>
                  <Texto variante="caption">
                    Al desactivarla deja de aparecer en el catálogo público. No se borra la categoría ni su historial de
                    precios.
                  </Texto>
                </View>
                <Switch
                  accessibilityLabel="Categoría activa"
                  value={form.activa}
                  disabled={ocupado}
                  onValueChange={(v) => cambiar('activa', v)}
                  trackColor={{ false: colores.lineaFuerte, true: colores.marca }}
                  thumbColor={colores.superficie}
                />
              </View>

              <View style={s.preview}>
                <Texto variante="etiqueta">Así lo ve el cliente</Texto>
                <View style={s.lineaPreview}>
                  <Texto>Tarifa base de visita</Texto>
                  <Texto variante="cuerpoFuerte">{bolivianos(visita)}</Texto>
                </View>
                <View style={s.lineaPreview}>
                  <Texto>Recargo por urgencia ({recargo ?? '—'}%)</Texto>
                  <Texto variante="cuerpoFuerte">
                    {recargoMonto === null ? '—' : `+ ${bolivianos(recargoMonto)}`}
                  </Texto>
                </View>
                <View style={[s.lineaPreview, s.totalPreview]}>
                  <Texto variante="cuerpoFuerte">Total estimado con urgencia</Texto>
                  <Texto variante="cuerpoFuerte">{bolivianos(total)}</Texto>
                </View>
                <Texto variante="caption">
                  Ejemplo orientativo de una visita con recargo. La tarifa por hora se suma según el trabajo realizado.
                </Texto>
                {!form.activa ? (
                  <Texto variante="caption" color={colores.advertencia}>
                    Categoría inactiva: esta vista previa no se muestra en el catálogo público.
                  </Texto>
                ) : null}
              </View>

              {confirmarDesactivar ? (
                <Aviso tono="advertencia" titulo="Confirma la desactivación">
                  La categoría dejará de estar disponible para nuevas solicitudes. Los registros anteriores y el
                  historial de precios se conservan.
                </Aviso>
              ) : null}

              <BotonPrimario
                titulo={
                  confirmarDesactivar ? 'Confirmar desactivación' : nueva ? 'Crear categoría' : 'Guardar cambios'
                }
                tamano="escritorio"
                cargando={ocupado}
                onPress={() => void guardar()}
              />
              <BotonPrimario
                titulo="Cancelar"
                variante="secundario"
                tamano="escritorio"
                deshabilitado={ocupado}
                onPress={cerrarEditor}
              />
            </Tarjeta>
          ) : (
            <Tarjeta style={s.tarjeta}>
              <Texto variante="subtitulo">Selecciona una categoría</Texto>
              <Texto color={colores.secundario}>
                Aquí se editan el nombre, la descripción y las tarifas. También puedes crear una categoría
                nueva.
              </Texto>
              <Texto variante="caption">
                Los cambios de precio realizados en otro día cierran la versión anterior y abren una nueva; nunca se
                reescribe el historial.
              </Texto>
            </Tarjeta>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { gap: espacio.lg },
  columnas: { gap: espacio.lg },
  columnasDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  lista: { gap: espacio.md, minWidth: 0 },
  editor: { minWidth: 0 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm, alignItems: 'center' },
  filtro: {
    paddingHorizontal: espacio.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: radio.control,
    backgroundColor: colores.superficie,
  },
  filtroActivo: { backgroundColor: colores.marcaSuave, borderColor: colores.marca },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    padding: espacio.base,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.linea,
    borderRadius: radio.tarjeta,
  },
  filaActiva: { borderColor: colores.marca, backgroundColor: colores.marcaSuave },
  filaTextos: { flex: 1, minWidth: 0, gap: espacio.xs },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm },
  nombre: { flexShrink: 1 },
  tarjeta: { gap: espacio.base },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: espacio.base },
  interruptorTextos: { flex: 1, gap: espacio.xs },
  preview: {
    gap: espacio.sm,
    padding: espacio.base,
    backgroundColor: colores.fondo,
    borderRadius: radio.control,
    borderWidth: 1,
    borderColor: colores.linea,
  },
  lineaPreview: { flexDirection: 'row', justifyContent: 'space-between', gap: espacio.md },
  totalPreview: { borderTopWidth: 1, borderTopColor: colores.linea, paddingTop: espacio.sm },
});

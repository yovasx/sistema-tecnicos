import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoriaAdmin } from '../../domain/models/Admin';
import { FilaOrdenAdmin, FiltrosOrdenesAdmin, PaginaOrdenes } from '../../domain/models/OrdenAdmin';
import { adminRepository, ordenesAdminRepository as repo } from '../../infrastructure/di';
import { guardarRutaOrdenAdmin, leerRutaAdmin } from '../../infrastructure/navigation/rutaAdmin';
import { useResponsive } from '../../theme/responsive';
import { colores } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { TablaAdmin } from '../../ui/admin/TablaAdmin';
import { FichaOrdenAdmin } from './ordenes/FichaOrdenAdmin';
import { errorOrden, EstadoOrden, estadosOrden, fechaOrden, PersonaResumenOrden } from './ordenes/presentacionOrden';

const iniciales: FiltrosOrdenesAdmin = {
  busqueda: '', estado: 'todos', asignacion: 'todos', desde: '', hasta: '', pagina: 0, tamano: 20,
};
function fechaValida(valor: string) {
  if (!valor) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor;
}

export function OrdenesAdminScreen() {
  const { esDesktop } = useResponsive();
  return esDesktop ? <DirectorioOrdenes /> : <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;
}

function DirectorioOrdenes() {
  const { ancho } = useResponsive();
  const [id, setId] = useState(() => leerRutaAdmin().orden);
  const [filtros, setFiltros] = useState(iniciales);
  const [borrador, setBorrador] = useState(iniciales);
  const [datos, setDatos] = useState<PaginaOrdenes<FilaOrdenAdmin> | null>(null);
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [errorCategorias, setErrorCategorias] = useState('');
  const [error, setError] = useState('');
  const [errorFechas, setErrorFechas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const consulta = useRef(0);
  const desdeInvalido = !fechaValida(borrador.desde);
  const hastaInvalido = !fechaValida(borrador.hasta);
  const rangoInvertido = !desdeInvalido && !hastaInvalido && !!borrador.desde && !!borrador.hasta && borrador.desde > borrador.hasta;
  const sinAplicar = JSON.stringify({ ...borrador, pagina: 0 }) !== JSON.stringify({ ...filtros, pagina: 0 });
  useEffect(() => {
    if (id !== null) return;
    const actual = ++consulta.current;
    setCargando(true); setError('');
    repo.listar(filtros).then(d => { if (actual === consulta.current) setDatos(d); })
      .catch(e => { if (actual === consulta.current) { setError(errorOrden(e)); setDatos(null); } })
      .finally(() => { if (actual === consulta.current) setCargando(false); });
    return () => { consulta.current++; };
  }, [filtros, recarga, id]);
  useEffect(() => {
    let vigente = true; setErrorCategorias('');
    adminRepository.categorias().then(d => { if (vigente) setCategorias(d); })
      .catch(e => { if (vigente) setErrorCategorias(errorOrden(e)); });
    return () => { vigente = false; };
  }, [recarga]);
  function aplicar() {
    setErrorFechas(true);
    if (desdeInvalido || hastaInvalido || rangoInvertido) return;
    setFiltros({ ...borrador, busqueda: borrador.busqueda.trim(), pagina: 0 });
    setBorrador(b => ({ ...b, busqueda: b.busqueda.trim() }));
  }
  function limpiar() {
    setBorrador(iniciales); setFiltros({ ...iniciales }); setErrorFechas(false);
  }
  function abrir(valor: number | null) { guardarRutaOrdenAdmin(valor); setId(valor); }
  if (id !== null) return <FichaOrdenAdmin key={id} id={id} onVolver={() => abrir(null)} />;
  const hayFiltros = !!filtros.busqueda || filtros.estado !== 'todos' || filtros.asignacion !== 'todos' ||
    !!filtros.categoria || !!filtros.desde || !!filtros.hasta;
  return <View style={s.raiz}>
    <View style={s.fila}><Ionicons name="receipt-outline" size={18} color={colores.marca} /><Texto variante="caption">Operación / Órdenes</Texto></View>
    <Encabezado titulo="Órdenes" subtitulo="Consulta el servicio, las personas y el historial registrado de cada solicitud."
      derecha={<BotonPrimario titulo="Actualizar órdenes" tamano="escritorio" variante="secundario"
        deshabilitado={cargando} onPress={() => setRecarga(n => n + 1)} />} />
    <View style={s.entre}><Texto variante="subtitulo">{datos?.total ?? '—'} {datos?.total === 1 ? 'orden encontrada' : 'órdenes encontradas'}</Texto>
      <Chip texto="Consulta administrativa · solo lectura" tono="marca" /></View>
    <Tarjeta relleno={20} style={{ gap: 20 }}>
      <CampoTexto etiqueta="Buscar órdenes" value={borrador.busqueda} maxLength={150}
        placeholder="ID exacto, nombre del cliente o del técnico" autoCapitalize="none"
        onChangeText={busqueda => setBorrador(b => ({ ...b, busqueda }))} onSubmitEditing={aplicar} />
      <View style={s.filaFiltros}>
        <FiltroAdmin etiqueta="Estado de la orden" valor={borrador.estado}
          opciones={[['todos', 'Todos'], ...Object.entries(estadosOrden)]}
          onChange={estado => setBorrador(b => ({ ...b, estado: estado as FiltrosOrdenesAdmin['estado'] }))} />
        <FiltroAdmin etiqueta="Asignación" valor={borrador.asignacion}
          opciones={[['todos', 'Todas'], ['asignada', 'Con técnico'], ['sin_asignar', 'Sin asignar']]}
          onChange={asignacion => setBorrador(b => ({ ...b, asignacion: asignacion as FiltrosOrdenesAdmin['asignacion'] }))} />
      </View>
      {categorias.length ? <FiltroAdmin etiqueta="Categoría del servicio" valor={String(borrador.categoria ?? 'todos')}
        opciones={[['todos', 'Todas'], ...categorias.map(c => [String(c.id), `${c.nombre}${c.activa ? '' : ' (inactiva)'}`] as const)]}
        onChange={v => setBorrador(b => ({ ...b, categoria: v === 'todos' ? undefined : Number(v) }))} /> : null}
      {errorCategorias ? <Aviso tono="peligro" titulo="Categorías no disponibles">{errorCategorias} Usa Actualizar órdenes para reintentar.</Aviso> : null}
      <View style={s.filaFiltros}>
        <View style={s.fecha}><CampoTexto etiqueta="Creada desde" value={borrador.desde} placeholder="AAAA-MM-DD" maxLength={10}
          error={errorFechas && desdeInvalido ? 'Escribe una fecha válida: AAAA-MM-DD.' : undefined}
          onChangeText={desde => setBorrador(b => ({ ...b, desde }))} onSubmitEditing={aplicar} /></View>
        <View style={s.fecha}><CampoTexto etiqueta="Creada hasta" value={borrador.hasta} placeholder="AAAA-MM-DD" maxLength={10}
          error={errorFechas && (hastaInvalido || rangoInvertido) ? rangoInvertido ? 'La fecha final no puede ser anterior a la inicial.' : 'Escribe una fecha válida: AAAA-MM-DD.' : undefined}
          onChangeText={hasta => setBorrador(b => ({ ...b, hasta }))} onSubmitEditing={aplicar} /></View>
      </View>
      <View style={s.entre}>
        <View style={{ gap: 8 }}><Texto variante="caption">Fechas de creación en horario de Bolivia. Ambos días están incluidos.</Texto>
          {sinAplicar ? <Chip texto="Filtros sin aplicar" tono="advertencia" /> : <Texto variante="caption">Más recientes primero · aplica los filtros para actualizar la búsqueda.</Texto>}</View>
        <View style={s.fila}><BotonPrimario titulo="Limpiar filtros de órdenes" variante="secundario" tamano="escritorio" onPress={limpiar} />
          <BotonPrimario titulo="Aplicar filtros" tamano="escritorio" onPress={aplicar} /></View>
      </View>
    </Tarjeta>
    {error ? <Aviso tono="peligro" titulo="No pudimos cargar las órdenes">{error} Puedes reintentar con Actualizar órdenes.</Aviso> : null}
    {cargando ? <View style={s.fila}><ActivityIndicator color={colores.marca} /><Texto variante="caption">Cargando órdenes…</Texto></View> : null}
    {!error && !cargando && datos?.total === 0 ? <Tarjeta style={{ gap: 12 }}>
      <Ionicons name="receipt-outline" size={30} color={colores.marca} />
      <Texto variante="subtitulo">{hayFiltros ? 'No hay órdenes que coincidan' : 'Todavía no hay órdenes registradas'}</Texto>
      <Texto color={colores.secundario}>{hayFiltros ? 'Intenta otra búsqueda, amplía las fechas o limpia los filtros.' :
        'Este módulo mostrará las solicitudes reales cuando existan. No se agregan órdenes de ejemplo ni se crean desde administración.'}</Texto>
    </Tarjeta> : !error && datos ? <TablaAdmin filas={datos.elementos} clave={o => String(o.id)}
      pagina={datos.pagina} tamano={datos.tamano} total={datos.total} ocupado={cargando}
      onPagina={pagina => setFiltros(f => ({ ...f, pagina }))} anchoMinimo={ancho >= 1280 ? 1020 : 760}
      columnas={[
        { clave: 'orden', titulo: 'ORDEN / SERVICIO', ancho: ancho >= 1280 ? 180 : 150, render: o => <View style={{ gap: 8 }}>
          <Texto variante="cuerpoFuerte">#{o.id}</Texto><Texto variante="caption">{o.categoria.nombre}</Texto>
          {ancho < 1280 ? <Texto variante="caption">{fechaOrden(o.creadoEn)}</Texto> : null}
          {o.tarifaUrgencia ? <Chip texto="Urgencia" tono="advertencia" /> : null}</View> },
        { clave: 'personas', titulo: 'CLIENTE / TÉCNICO', render: o => <View style={{ gap: 10 }}>
          <PersonaResumenOrden persona={o.cliente} />
          <View style={{ gap: 4 }}><Texto variante="caption">Técnico</Texto><PersonaResumenOrden persona={o.tecnico} sinDato="Sin asignar" /></View></View> },
        { clave: 'estado', titulo: 'ESTADO', ancho: 155, render: o => <EstadoOrden estado={o.estado} /> },
        ...(ancho >= 1280 ? [{ clave: 'fecha', titulo: 'CREADA (BOLIVIA)', ancho: 180,
          render: (o: FilaOrdenAdmin) => <Texto variante="caption">{fechaOrden(o.creadoEn)}</Texto> }] : []),
        { clave: 'accion', titulo: 'CONSULTA', ancho: 170, render: o => <BotonPrimario titulo="Ver orden" etiquetaAccesible={`Ver orden ${o.id}`}
          variante="secundario" tamano="escritorio" deshabilitado={cargando} onPress={() => abrir(o.id)} /> },
      ]} /> : null}
    <Texto variante="caption">Sin asignaciones ni cambios de estado desde esta vista. No se muestran importes, SLA ni posiciones en vivo.</Texto>
  </View>;
}
const s = StyleSheet.create({
  raiz: { gap: 24 }, fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  entre: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  filaFiltros: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' },
  fecha: { flex: 1, minWidth: 220 },
});

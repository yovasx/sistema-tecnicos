import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Expediente, ExpedienteAdmin } from '../../domain/models/Expediente';
import { tecnicoRepository as repo, tecnicosAdminRepository } from '../../infrastructure/di';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { FiltroAdmin } from '../../ui/admin/FiltroAdmin';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';
import { colores } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { ExpedienteTecnicoAdmin, estadosExpediente } from './ExpedienteTecnicoAdmin';

/** W49: cola de revisión; comparte el documento y las decisiones con W61. */
export function ValidacionAdminScreen() {
  const { ancho } = useResponsive();
  const [estado, setEstado] = useState('en_revision');
  const [lista, setLista] = useState<ExpedienteAdmin[]>([]);
  const [seleccionado, setSeleccionado] = useState<ExpedienteAdmin | null>(null);
  const [detalle, setDetalle] = useState<Expediente | null>(null);
  const [cuentaActiva, setCuentaActiva] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [interaccion, setInteraccion] = useState({ sucio: false, ocupado: false });
  const consulta = useRef(0);
  const definirInteraccion = useCallback((sucio: boolean, ocupado: boolean) => setInteraccion({ sucio, ocupado }), []);
  useCambiosSinGuardar(interaccion.sucio, interaccion.ocupado);
  const bloqueado = interaccion.sucio || interaccion.ocupado || cargando;
  const cargar = useCallback(async () => {
    const actual = ++consulta.current; setCargando(true); setError('');
    try { const datos = await repo.cola(estado); if (actual === consulta.current) setLista(datos); }
    catch (e) { if (actual === consulta.current) setError(e instanceof Error ? e.message : 'No pudimos cargar la cola.'); }
    finally { if (actual === consulta.current) setCargando(false); }
  }, [estado]);
  useEffect(() => {
    setSeleccionado(null); setDetalle(null); void cargar();
    return () => { consulta.current++; };
  }, [cargar]);
  async function abrir(fila: ExpedienteAdmin) {
    if (bloqueado) return;
    const actual = ++consulta.current;
    setError(''); setDetalle(null); setSeleccionado(fila); setCargando(true); setMensaje('');
    try {
      // El snapshot administrativo conserva el estado de cuenta, incluso inactiva.
      const d = await tecnicosAdminRepository.detalle(fila.tecnicoId);
      if (actual === consulta.current) { setDetalle(d.expediente); setCuentaActiva(d.cuenta.activo); }
    } catch (e) { if (actual === consulta.current) setError(e instanceof Error ? e.message : 'No pudimos cargar el expediente.'); }
    finally { if (actual === consulta.current) setCargando(false); }
  }
  function completado() {
    setMensaje('Revisión completada. La decisión quedó auditada.');
    setSeleccionado(null); setDetalle(null); void cargar();
  }
  return <View style={{ gap: 24 }}>
    <Encabezado titulo="Revisión de técnicos" subtitulo="Revisá los expedientes enviados. La aprobación documental no sustituye la activación de la cuenta." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
      <FiltroAdmin etiqueta="Estado del expediente" valor={estado} deshabilitado={bloqueado}
        opciones={['en_revision', 'observado', 'aprobado', 'rechazado'].map(v => [v, estadosExpediente[v]] as const)}
        onChange={setEstado} />
      <BotonPrimario titulo="Actualizar cola" tamano="escritorio" variante="secundario" deshabilitado={bloqueado} onPress={() => void cargar()} />
    </View>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    {mensaje ? <Aviso tono="exito">{mensaje}</Aviso> : null}
    {cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {!lista.length && !cargando && !error ? <Aviso titulo="Nada por validar">No hay expedientes en este estado. Los borradores y las aprobaciones anteriores no aparecen en esta cola.</Aviso> : null}
    <View style={{ flexDirection: ancho >= 1360 ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ width: ancho >= 1360 ? 300 : '100%', gap: 12 }}>
        <Texto variante="etiqueta">{lista.length} expediente(s)</Texto>
        {lista.map(t => <Pressable key={t.tecnicoId} accessibilityRole="button" accessibilityLabel={`Revisar expediente de ${t.nombre}`}
          accessibilityState={{ selected: seleccionado?.tecnicoId === t.tecnicoId }} disabled={bloqueado} onPress={() => void abrir(t)}>
          <Tarjeta style={{ gap: 8, ...(seleccionado?.tecnicoId === t.tecnicoId ? { borderColor: colores.marca } : {}) }} relleno={20}>
            <Texto variante="cuerpoFuerte">{t.nombre}</Texto>
            <Texto variante="caption">{t.email}</Texto>
            <Texto variante="etiqueta" color={colores.marca}>Revisar expediente →</Texto>
          </Tarjeta>
        </Pressable>)}
      </View>
      <View style={{ flex: 1, minWidth: 0, width: '100%' }}>
        {seleccionado && detalle ? <Tarjeta style={{ gap: 20 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <Texto variante="titulo">{seleccionado.nombre}</Texto>
            <BotonPrimario titulo="Cerrar detalle" variante="secundario" tamano="escritorio" deshabilitado={bloqueado}
              onPress={() => { setSeleccionado(null); setDetalle(null); }} />
          </View>
          <Texto variante="caption">Especialidades: {detalle.especialidades.map(c => c.nombre).join(', ') || 'Sin registrar'}</Texto>
          <Texto variante="caption">Cobertura: {detalle.zonas.map(z => z.nombre).join(', ') || 'Sin registrar'}</Texto>
          <ExpedienteTecnicoAdmin key={seleccionado.tecnicoId} id={seleccionado.tecnicoId} expediente={detalle}
            cuentaActiva={cuentaActiva} onCambio={completado} onInteraccion={definirInteraccion} />
        </Tarjeta> : <Tarjeta style={{ gap: 12 }}><Texto variante="subtitulo">Seleccioná un expediente</Texto>
          <Texto color={colores.secundario}>Consultá los documentos privados y registrá una decisión con sus observaciones.</Texto></Tarjeta>}
      </View>
    </View>
  </View>;
}

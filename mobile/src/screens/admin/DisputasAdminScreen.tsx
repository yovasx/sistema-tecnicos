import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Disputa } from '../../domain/models/Backoffice';
import { backofficeRepository } from '../../infrastructure/di';
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
import { fechaHoraBolivia } from '../../ui/formato';
import { usePaginaAdmin } from './usePaginaAdmin';

const estados: Record<Disputa['estado'], string> = {
  abierta: 'Abierta',
  en_revision: 'En revisión',
  resuelta: 'Resuelta',
};

export function DisputasAdminScreen() {
  const { esDesktop } = useResponsive();
  if (!esDesktop) return <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;
  return <ColaDisputas />;
}

function ColaDisputas() {
  const [estado, setEstado] = useState('');
  const consulta = usePaginaAdmin(p => backofficeRepository.disputas(estado, p), [estado]);
  const [seleccionada, setSeleccionada] = useState<Disputa | null>(null);

  return <View style={s.raiz}>
    <Encabezado titulo="Disputas" subtitulo="Reclamos de clientes y técnicos sobre órdenes cerradas."
      derecha={<BotonPrimario titulo="Actualizar disputas" tamano="escritorio" variante="secundario"
        deshabilitado={consulta.cargando} onPress={consulta.actualizar} />} />
    <FiltroAdmin etiqueta="Estado de la disputa" valor={estado || 'todas'}
      opciones={[['todas', 'Todas'], ['abierta', 'Abiertas'], ['en_revision', 'En revisión'], ['resuelta', 'Resueltas']]}
      onChange={v => { setSeleccionada(null); consulta.reiniciar(); setEstado(v === 'todas' ? '' : v); }} />
    {consulta.error ? <Aviso tono="peligro">{consulta.error}</Aviso> : null}
    {consulta.cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {consulta.datos ? <TablaAdmin filas={consulta.datos.elementos} clave={d => String(d.id)}
      pagina={consulta.datos.pagina} tamano={consulta.datos.tamano} total={consulta.datos.total}
      ocupado={consulta.cargando} onPagina={consulta.irA} anchoMinimo={860}
      columnas={[
        { clave: 'orden', titulo: 'DISPUTA / ORDEN', ancho: 170, render: d => <View style={{ gap: 4 }}>
          <Texto variante="cuerpoFuerte">Disputa #{d.id}</Texto>
          <Texto variante="caption">Orden #{d.orden} · {d.categoria}</Texto>
          <Texto variante="caption">{fechaHoraBolivia(d.abiertaEn)}</Texto></View> },
        { clave: 'partes', titulo: 'PARTES', render: d => <View style={{ gap: 4 }}>
          <Texto variante="caption">Abre: {d.abiertaPor ?? 'Cuenta eliminada'}</Texto>
          <Texto variante="caption">Contra: {d.contraUsuario ?? 'Cuenta eliminada'}</Texto>
          <Texto variante="caption" numberOfLines={3}>{d.motivo}</Texto></View> },
        { clave: 'estado', titulo: 'ESTADO', ancho: 150, render: d => <View style={{ gap: 6 }}>
          <Chip texto={estados[d.estado]} tono={d.estado === 'resuelta' ? 'exito' : d.estado === 'abierta' ? 'advertencia' : 'marca'} />
          {d.administrador ? <Texto variante="caption">Revisa: {d.administrador}</Texto> : null}</View> },
        { clave: 'accion', titulo: 'REVISIÓN', ancho: 170, render: d => <BotonPrimario
          titulo={d.estado === 'resuelta' ? 'Ver resolución' : 'Revisar disputa'}
          etiquetaAccesible={`Revisar disputa ${d.id}`} variante="secundario" tamano="escritorio"
          onPress={() => setSeleccionada(d)} /> },
      ]} /> : null}
    {seleccionada ? <RevisionDisputa disputa={seleccionada} onCerrar={() => setSeleccionada(null)}
      onGuardado={() => { setSeleccionada(null); consulta.actualizar(); }} /> : null}
    <Texto variante="caption">La resolución queda registrada con tu cuenta y se notifica a ambas partes.
      No hay reembolsos automáticos: los cobros en línea no están habilitados.</Texto>
  </View>;
}

function RevisionDisputa({ disputa, onCerrar, onGuardado }: {
  disputa: Disputa; onCerrar: () => void; onGuardado: () => void;
}) {
  const [resolucion, setResolucion] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const invalida = resolucion.trim().length < 10 || resolucion.trim().length > 2000;

  async function guardar(estado: 'en_revision' | 'resuelta') {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      await backofficeRepository.revisarDisputa(disputa.id, estado, resolucion.trim());
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar la revisión.');
    } finally {
      setOcupado(false);
    }
  }

  return <Tarjeta relleno={20} style={{ gap: 16 }}>
    <Texto variante="subtitulo">Disputa #{disputa.id} · orden #{disputa.orden}</Texto>
    <Texto variante="caption">Motivo declarado por {disputa.abiertaPor ?? 'una cuenta eliminada'}:</Texto>
    <Texto>{disputa.motivo}</Texto>
    {disputa.estado === 'resuelta' ? <>
      <Chip texto="Resuelta" tono="exito" />
      <Texto>{disputa.resolucion}</Texto>
      <Texto variante="caption">{disputa.resueltaEn ? fechaHoraBolivia(disputa.resueltaEn) : ''}</Texto>
      <BotonPrimario titulo="Cerrar detalle" variante="secundario" onPress={onCerrar} />
    </> : <>
      <CampoTexto etiqueta="Resolución o nota de revisión" value={resolucion} multiline maxLength={2000}
        placeholder="Explica la decisión y los próximos pasos para ambas partes"
        error={confirmar && invalida ? 'Escribe entre 10 y 2000 caracteres.' : undefined}
        onChangeText={setResolucion} />
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      {disputa.estado === 'abierta' ? <BotonPrimario titulo="Marcar en revisión" variante="secundario"
        deshabilitado={ocupado} cargando={ocupado} onPress={() => void guardar('en_revision')} /> : null}
      {!confirmar ? <BotonPrimario titulo="Resolver disputa" deshabilitado={ocupado}
        onPress={() => { setConfirmar(true); }} /> : <>
        <Aviso tono="advertencia">La disputa quedará cerrada y no podrás volver a abrirla desde esta vista.</Aviso>
        <View style={s.fila}>
          <BotonPrimario titulo="Confirmar resolución" deshabilitado={ocupado || invalida} cargando={ocupado}
            onPress={() => void guardar('resuelta')} />
          <BotonPrimario titulo="Cancelar" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
        </View>
      </>}
    </>}
  </Tarjeta>;
}

const s = StyleSheet.create({
  raiz: { gap: 24 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

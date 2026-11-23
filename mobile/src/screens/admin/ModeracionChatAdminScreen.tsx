import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { MensajeModerado } from '../../domain/models/Backoffice';
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

export function ModeracionChatAdminScreen() {
  const { esDesktop } = useResponsive();
  if (!esDesktop) return <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;
  return <ColaModeracion />;
}

function ColaModeracion() {
  const [pendientes, setPendientes] = useState(true);
  const consulta = usePaginaAdmin(p => backofficeRepository.moderacion(pendientes, p), [pendientes]);
  const [seleccionado, setSeleccionado] = useState<MensajeModerado | null>(null);

  return <View style={s.raiz}>
    <Encabezado titulo="Moderación de chat" subtitulo="Mensajes con posible contacto externo detectados automáticamente."
      derecha={<BotonPrimario titulo="Actualizar mensajes" tamano="escritorio" variante="secundario"
        deshabilitado={consulta.cargando} onPress={consulta.actualizar} />} />
    <FiltroAdmin etiqueta="Mensajes a mostrar" valor={pendientes ? 'pendientes' : 'todos'}
      opciones={[['pendientes', 'Pendientes de revisión'], ['todos', 'Todos los detectados']]}
      onChange={v => { setSeleccionado(null); consulta.reiniciar(); setPendientes(v === 'pendientes'); }} />
    {consulta.error ? <Aviso tono="peligro">{consulta.error}</Aviso> : null}
    {consulta.cargando ? <ActivityIndicator color={colores.marca} /> : null}
    {consulta.datos && !consulta.datos.total && pendientes ? <Tarjeta style={{ gap: 8 }}>
      <Texto variante="subtitulo">No hay mensajes por revisar</Texto>
      <Texto color={colores.secundario}>La detección marca teléfonos, correos, enlaces y menciones a mensajería
        dentro del chat privado de cada orden.</Texto>
    </Tarjeta> : null}
    {consulta.datos && consulta.datos.total ? <TablaAdmin filas={consulta.datos.elementos} clave={m => String(m.id)}
      pagina={consulta.datos.pagina} tamano={consulta.datos.tamano} total={consulta.datos.total}
      ocupado={consulta.cargando} onPagina={consulta.irA} anchoMinimo={900}
      columnas={[
        { clave: 'mensaje', titulo: 'MENSAJE', render: m => <View style={{ gap: 4 }}>
          <Texto variante="caption">Orden #{m.orden} · {m.categoria}</Texto>
          <Texto numberOfLines={4}>{m.contenido}</Texto>
          <Texto variante="caption">{fechaHoraBolivia(m.enviadoEn)}</Texto></View> },
        { clave: 'partes', titulo: 'EMISOR / RECEPTOR', ancho: 210, render: m => <View style={{ gap: 4 }}>
          <Texto variante="caption">De: {m.emisor ?? 'Cuenta eliminada'}</Texto>
          <Texto variante="caption">Para: {m.receptor ?? 'Cuenta eliminada'}</Texto></View> },
        { clave: 'estado', titulo: 'REVISIÓN', ancho: 170, render: m => m.revisado ? <View style={{ gap: 6 }}>
          <Chip texto={m.decision === 'advertencia' ? 'Advertencia' : 'Sin acción'}
            tono={m.decision === 'advertencia' ? 'advertencia' : 'exito'} />
          {m.nota ? <Texto variante="caption" numberOfLines={3}>{m.nota}</Texto> : null}
        </View> : <Chip texto="Pendiente" tono="advertencia" /> },
        { clave: 'accion', titulo: 'DECISIÓN', ancho: 170, render: m => <BotonPrimario
          titulo={m.revisado ? 'Cambiar decisión' : 'Revisar mensaje'} etiquetaAccesible={`Revisar mensaje ${m.id}`}
          variante="secundario" tamano="escritorio" onPress={() => setSeleccionado(m)} /> },
      ]} /> : null}
    {seleccionado ? <RevisionMensaje mensaje={seleccionado} onCerrar={() => setSeleccionado(null)}
      onGuardado={() => { setSeleccionado(null); consulta.actualizar(); }} /> : null}
    <Texto variante="caption">La revisión registra tu decisión; no borra mensajes ni suspende cuentas.
      Las sanciones requieren un flujo propio que todavía no está habilitado.</Texto>
  </View>;
}

function RevisionMensaje({ mensaje, onCerrar, onGuardado }: {
  mensaje: MensajeModerado; onCerrar: () => void; onGuardado: () => void;
}) {
  const [nota, setNota] = useState(mensaje.nota ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardar(decision: 'sin_accion' | 'advertencia') {
    if (ocupado) return;
    if (nota.trim() && (nota.trim().length < 5 || nota.trim().length > 500)) {
      setError('La nota debe tener entre 5 y 500 caracteres, o quedar vacía.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      await backofficeRepository.revisarMensaje(mensaje.id, decision, nota.trim());
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar la revisión.');
    } finally {
      setOcupado(false);
    }
  }

  return <Tarjeta relleno={20} style={{ gap: 16 }}>
    <Texto variante="subtitulo">Mensaje #{mensaje.id} · orden #{mensaje.orden}</Texto>
    <Texto>{mensaje.contenido}</Texto>
    <CampoTexto etiqueta="Nota interna de moderación (opcional)" value={nota} multiline maxLength={500}
      placeholder="Contexto de la decisión para el equipo" onChangeText={setNota} />
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    <View style={s.fila}>
      <BotonPrimario titulo="Marcar sin acción" variante="secundario" deshabilitado={ocupado}
        onPress={() => void guardar('sin_accion')} />
      <BotonPrimario titulo="Registrar advertencia" deshabilitado={ocupado} cargando={ocupado}
        onPress={() => void guardar('advertencia')} />
      <BotonPrimario titulo="Cancelar" variante="secundario" deshabilitado={ocupado} onPress={onCerrar} />
    </View>
  </Tarjeta>;
}

const s = StyleSheet.create({
  raiz: { gap: 24 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

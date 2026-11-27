import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { backofficeRepository as repo } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { fechaHoraBolivia } from '../../ui/formato';
import { useCambiosSinGuardar } from '../../ui/admin/CambiosAdmin';

export function ReclamosServicio({ orden, onEdicion, bloqueado = false }: {
  orden: number; onEdicion?: (v: boolean) => void; bloqueado?: boolean;
}) {
  const [pagina, setPagina] = useState(0);
  const c = useConsulta(() => repo.propiasDisputas(pagina, orden), [orden, pagina]);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  useCambiosSinGuardar(!!motivo, ocupado);
  useEffect(() => { onEdicion?.(!!motivo || ocupado); return () => onEdicion?.(false); }, [motivo, ocupado, onEdicion]);
  async function abrir() {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await repo.abrirDisputa(orden, motivo.trim()); setMotivo(''); setPagina(0); c.actualizar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos registrar el reclamo.'); c.actualizar(); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">Reclamos del servicio</Texto>
    <Texto variante="caption">Coordinación revisa los reclamos. No hay reembolsos automáticos ni una garantía comercial implícita.</Texto>
    {c.error || error ? <Aviso tono="peligro">{c.error || error}</Aviso> : null}
    {c.datos?.elementos.map(d => <View key={d.id} style={{ gap: 6 }}>
      <Texto variante="cuerpoFuerte">Reclamo #{d.id} · {d.estado.replaceAll('_', ' ')}</Texto>
      <Texto>{d.motivo}</Texto><Texto variante="caption">{fechaHoraBolivia(d.abiertaEn)}</Texto>
      {d.resolucion ? <Aviso titulo="Resolución">{d.resolucion}</Aviso> : null}
    </View>)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <BotonPrimario titulo="Actualizar reclamos" variante="secundario" deshabilitado={ocupado || bloqueado} onPress={c.actualizar} />
      {pagina > 0 ? <BotonPrimario titulo="Anteriores" variante="secundario" deshabilitado={ocupado || bloqueado} onPress={() => setPagina(p => p - 1)} /> : null}
      {c.datos && (pagina + 1) * 20 < c.datos.total ? <BotonPrimario titulo="Siguientes" variante="secundario" deshabilitado={ocupado || bloqueado} onPress={() => setPagina(p => p + 1)} /> : null}
    </View>
    <CampoTexto etiqueta="Motivo del reclamo" value={motivo} multiline maxLength={1000} editable={!ocupado && !bloqueado} onChangeText={setMotivo} />
    <BotonPrimario titulo="Registrar reclamo para revisión" cargando={ocupado}
      deshabilitado={bloqueado || motivo.trim().length < 10 || c.cargando} onPress={() => void abrir()} />
  </Tarjeta>;
}

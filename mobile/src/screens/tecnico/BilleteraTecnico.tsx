import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { operacionRepository } from '../../infrastructure/di';
import { useConsulta } from '../useConsulta';
import { MarcoContenido } from '../../ui/MarcoContenido';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { fechaHoraBolivia } from '../../ui/formato';

const estados: Record<string, string> = { pendiente_pago_tecnico: 'Pendiente de pago al técnico',
  pagada_tecnico: 'Pagada al técnico', por_cobrar_tecnico: 'Pendiente de cobro al técnico', cobrada_tecnico: 'Cobrada al técnico' };
export function BilleteraTecnico() {
  const [pagina, setPagina] = useState(0);
  const c = useConsulta(() => operacionRepository.liquidaciones(pagina), [pagina]);
  return <MarcoContenido>
    <Encabezado titulo="Billetera y liquidaciones" subtitulo="Consulta los importes realmente registrados para tu cuenta." />
    <Aviso>No se ofrecen retiros ni se confirma dinero recibido desde esta pantalla. La comisión es la registrada en cada liquidación, no un porcentaje inventado.</Aviso>
    {c.error ? <Aviso tono="peligro">{c.error}</Aviso> : null}
    <BotonPrimario titulo="Actualizar liquidaciones" variante="secundario" deshabilitado={c.cargando} onPress={c.actualizar} />
    {c.cargando ? <ActivityIndicator /> : null}
    {!c.cargando && !c.error && !c.datos?.elementos.length ? <Tarjeta><Texto>No tienes liquidaciones registradas. Esto no representa un saldo disponible de cero.</Texto></Tarjeta> : null}
    {!c.cargando ? c.datos?.elementos.map(l => <Tarjeta key={l.id} style={{ gap: 10 }}>
      <Texto variante="subtitulo">Liquidación #{l.id} · Servicio #{l.orden}</Texto>
      <Texto>{estados[l.estado] || l.estado}</Texto>
      <Texto>Bruto: {l.bruto.toFixed(2)} {l.moneda}</Texto>
      <Texto>Comisión: {l.comision.toFixed(2)} {l.moneda}</Texto>
      <Texto variante="cuerpoFuerte">Neto: {l.neto.toFixed(2)} {l.moneda}</Texto>
      <Texto variante="caption">{fechaHoraBolivia(l.creadaEn)}</Texto>
    </Tarjeta>) : null}
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <BotonPrimario titulo="Anterior" variante="secundario" deshabilitado={!pagina || c.cargando} onPress={() => setPagina(p => p - 1)} />
      <BotonPrimario titulo="Siguiente" variante="secundario" deshabilitado={!c.datos || (pagina + 1) * 20 >= c.datos.total || c.cargando}
        onPress={() => setPagina(p => p + 1)} />
    </View>
  </MarcoContenido>;
}

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { backofficeRepository } from '../../infrastructure/di';
import { useResponsive } from '../../theme/responsive';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { CampoTexto } from '../../ui/CampoTexto';
import { Encabezado } from '../../ui/Encabezado';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';

function hoyMenos(dias: number) {
  const fecha = new Date(Date.now() - dias * 86400000);
  return fecha.toISOString().slice(0, 10);
}

function fechaValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor;
}

export function ReportesAdminScreen() {
  const { esDesktop } = useResponsive();
  const [desde, setDesde] = useState(hoyMenos(30));
  const [hasta, setHasta] = useState(hoyMenos(0));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [descargado, setDescargado] = useState(false);

  if (!esDesktop) return <Aviso>El panel administrativo se usa desde el backoffice web.</Aviso>;

  const invalido = !fechaValida(desde) || !fechaValida(hasta) || desde > hasta;

  async function descargar() {
    if (ocupado || invalido) return;
    setOcupado(true);
    setError('');
    setDescargado(false);
    try {
      await backofficeRepository.descargarReporte(desde, hasta);
      setDescargado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos generar el reporte.');
    } finally {
      setOcupado(false);
    }
  }

  return <View style={s.raiz}>
    <Encabezado titulo="Reportes" subtitulo="Exporta las órdenes reales del período en formato CSV." />
    <Tarjeta relleno={20} style={{ gap: 16 }}>
      <Texto variante="subtitulo">Órdenes por fecha de creación</Texto>
      <Texto variante="caption">Incluye categoría, estado, urgencia, técnico asignado y el total de la última
        cotización aceptada. Las fechas se interpretan en horario de Bolivia y ambos días están incluidos.</Texto>
      <View style={s.fila}>
        <View style={s.campo}><CampoTexto etiqueta="Desde" value={desde} placeholder="AAAA-MM-DD" maxLength={10}
          onChangeText={setDesde} /></View>
        <View style={s.campo}><CampoTexto etiqueta="Hasta" value={hasta} placeholder="AAAA-MM-DD" maxLength={10}
          onChangeText={setHasta} /></View>
      </View>
      {invalido ? <Aviso tono="advertencia">Escribe fechas válidas con formato AAAA-MM-DD y un rango de hasta
        366 días.</Aviso> : null}
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      {descargado ? <Aviso tono="exito">El archivo CSV se descargó en tu navegador.</Aviso> : null}
      <BotonPrimario titulo="Descargar reporte CSV" cargando={ocupado} deshabilitado={invalido}
        onPress={() => void descargar()} />
    </Tarjeta>
    <Texto variante="caption">El reporte no contiene direcciones, teléfonos ni documentos. Los importes
      corresponden a cotizaciones aceptadas, no a cobros confirmados.</Texto>
  </View>;
}

const s = StyleSheet.create({
  raiz: { gap: 24 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  campo: { flex: 1, minWidth: 220 },
});

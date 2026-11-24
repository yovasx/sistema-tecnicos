import { useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { View } from 'react-native';
import { PropsMapa, datosMapa, puntoValido } from './contrato';
import { htmlLeaflet } from './htmlLeaflet';

export function Mapa(props: PropsMapa) {
  const frame = useRef<WebView<{}>>(null);
  const html = useMemo(() => ({ html: htmlLeaflet() }), []);
  const actualizar = () => frame.current?.injectJavaScript(`window.actualizar && window.actualizar(${datosMapa(props)});true;`);
  useEffect(actualizar, [props.destino.latitud, props.destino.longitud, props.tecnico?.latitud, props.tecnico?.longitud,
    props.cliente?.latitud, props.cliente?.longitud, props.onSeleccionar, props.areas, props.etiquetaPunto, props.marcadores]);
  return <View style={{ height: props.alto ?? 360 }}><WebView<{}> ref={frame} source={html} originWhitelist={['about:blank']}
    style={{ flex: 1 }} javaScriptEnabled domStorageEnabled={false}
    onShouldStartLoadWithRequest={r => r.url === 'about:blank'}
    onLoadEnd={actualizar}
    onMessage={e => {
      try {
        const dato: unknown = JSON.parse(e.nativeEvent.data);
        if (puntoValido(dato)) props.onSeleccionar?.(dato);
      } catch { /* Mensajes ajenos al contrato no modifican el formulario. */ }
    }} /></View>;
}

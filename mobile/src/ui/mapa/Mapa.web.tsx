import { useEffect, useMemo, useRef } from 'react';
import { PropsMapa, datosMapa, puntoValido } from './contrato';
import { htmlLeaflet } from './htmlLeaflet';

export function Mapa(props: PropsMapa) {
  const frame = useRef<HTMLIFrameElement>(null);
  const actuales = useRef(props); actuales.current = props;
  const html = useMemo(htmlLeaflet, []);
  useEffect(() => {
    const recibir = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.tipo === 'listo')
        frame.current?.contentWindow?.postMessage(JSON.parse(datosMapa(actuales.current)), '*');
      if (e.data?.tipo === 'punto' && puntoValido(e.data)) actuales.current.onSeleccionar?.(e.data);
    };
    window.addEventListener('message', recibir);
    return () => window.removeEventListener('message', recibir);
  }, []);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(JSON.parse(datosMapa(props)), '*');
  }, [props.destino.latitud, props.destino.longitud, props.tecnico?.latitud, props.tecnico?.longitud,
    props.onSeleccionar, props.areas, props.etiquetaPunto, props.marcadores]);
  return <iframe ref={frame} title="Mapa del servicio con Leaflet" srcDoc={html}
    onLoad={() => frame.current?.contentWindow?.postMessage(JSON.parse(datosMapa(actuales.current)), '*')}
    sandbox="allow-scripts" referrerPolicy="no-referrer"
    style={{ width: '100%', height: props.alto ?? 360, border: 0, borderRadius: 16 }} />;
}

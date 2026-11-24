import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { atribucionMapa, urlMosaicosMapa } from './configuracionMapa';
import { PropsMapa, puntoValido } from './contrato';
import './Mapa.web.css';

function etiqueta(texto: string): HTMLSpanElement {
  const nodo = document.createElement('span');
  nodo.textContent = texto;
  return nodo;
}

function mensajeMapa(props: PropsMapa): string {
  if (props.onSeleccionar) return 'Mueve el pin o toca el mapa';
  if (props.marcadores?.length) return 'Azul: cliente · Verde: técnico';
  if (props.cliente || props.tecnico) return 'Azul: cliente · Verde: técnico';
  if (props.areas?.length) return 'Azul: cobertura vigente · Ámbar: propuesta';
  return `Azul: ${props.etiquetaPunto || 'destino'} · Verde: técnico`;
}

export function Mapa(props: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const propiedades = useRef(props);
  const destino = useRef<L.Marker | null>(null);
  const tecnico = useRef<L.CircleMarker | null>(null);
  const cliente = useRef<L.CircleMarker | null>(null);
  const areas = useRef<L.FeatureGroup | null>(null);
  const marcadores = useRef<L.FeatureGroup | null>(null);
  const areasCentradas = useRef(false);
  const centroTecnicoFijado = useRef(false);
  const centroClienteFijado = useRef(false);
  const claveMarcadores = useRef('');
  const [errorMosaicos, setErrorMosaicos] = useState(false);
  propiedades.current = props;

  useEffect(() => {
    if (!contenedor.current) return;
    const instancia = L.map(contenedor.current).setView(
      [propiedades.current.destino.latitud, propiedades.current.destino.longitud],
      15,
    );
    mapa.current = instancia;
    L.tileLayer(urlMosaicosMapa, { maxZoom: 19, attribution: atribucionMapa })
      .addTo(instancia)
      .on('tileerror', () => setErrorMosaicos(true))
      .on('tileload', () => setErrorMosaicos(false));
    instancia.on('click', (evento) => {
      propiedades.current.onSeleccionar?.({
        latitud: evento.latlng.lat,
        longitud: evento.latlng.lng,
      });
    });
    return () => {
      instancia.remove();
      mapa.current = null;
      destino.current = null;
      tecnico.current = null;
      cliente.current = null;
      areas.current = null;
      marcadores.current = null;
      areasCentradas.current = false;
      centroTecnicoFijado.current = false;
      centroClienteFijado.current = false;
      claveMarcadores.current = '';
    };
  }, []);

  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;
    const actual = propiedades.current;
    const punto: L.LatLngTuple = [actual.destino.latitud, actual.destino.longitud];

    if (!destino.current) {
      destino.current = L.marker(punto, {
        draggable: !!actual.onSeleccionar,
        icon: L.divIcon({
          className: 'fixly-mapa-pin-contenedor',
          html: '<div class="fixly-mapa-pin"><i></i></div>',
          iconSize: [28, 28],
          iconAnchor: [14, 26],
        }),
        keyboard: false,
      }).addTo(instancia);
      destino.current.on('dragend', () => {
        const ubicacion = destino.current?.getLatLng();
        if (!ubicacion) return;
        propiedades.current.onSeleccionar?.({
          latitud: ubicacion.lat,
          longitud: ubicacion.lng,
        });
      });
    } else {
      const previo = destino.current.getLatLng();
      destino.current.setLatLng(punto);
      if (Math.abs(previo.lat - punto[0]) > 1e-7 || Math.abs(previo.lng - punto[1]) > 1e-7)
        instancia.panTo(punto);
    }
    if (destino.current.dragging) {
      if (actual.onSeleccionar) destino.current.dragging.enable();
      else destino.current.dragging.disable();
    }
    destino.current.unbindTooltip().bindTooltip(etiqueta(actual.etiquetaPunto || 'Destino'));

    areas.current?.remove();
    const grupoAreas = L.featureGroup().addTo(instancia);
    (actual.areas ?? []).forEach((area) => {
      const estilo: L.PathOptions = {
        color: area.propuesta ? '#b36b00' : '#154b89',
        weight: 2,
        fillOpacity: 0.12,
        dashArray: area.propuesta ? '6 4' : undefined,
      };
      let capa: L.Layer | null = null;
      if (area.geometria?.type === 'Polygon' || area.geometria?.type === 'MultiPolygon')
        capa = L.geoJSON(area.geometria, { style: estilo });
      else if (puntoValido(area.centro)
        && typeof area.radioMetros === 'number'
        && Number.isFinite(area.radioMetros)
        && area.radioMetros >= 100
        && area.radioMetros <= 50000)
        capa = L.circle([area.centro.latitud, area.centro.longitud], {
          ...estilo,
          radius: area.radioMetros,
        });
      if (capa) {
        if ('bindTooltip' in capa)
          capa.bindTooltip(etiqueta(area.nombre || 'Cobertura'));
        capa.addTo(grupoAreas);
      }
    });
    areas.current = grupoAreas;
    if (!areasCentradas.current && grupoAreas.getLayers().length) {
      const limites = grupoAreas.getBounds();
      limites.extend(punto);
      instancia.fitBounds(limites, { padding: [30, 30], maxZoom: 15 });
      areasCentradas.current = true;
    }

    if (puntoValido(actual.tecnico)) {
      const ubicacion: L.LatLngTuple = [actual.tecnico.latitud, actual.tecnico.longitud];
      if (!tecnico.current)
        tecnico.current = L.circleMarker(ubicacion, {
          radius: 9, color: '#1a8754', fillOpacity: 1,
        }).addTo(instancia).bindTooltip('Técnico');
      else tecnico.current.setLatLng(ubicacion);
    } else if (tecnico.current) {
      tecnico.current.remove();
      tecnico.current = null;
    }
    if (puntoValido(actual.cliente)) {
      const ubicacion: L.LatLngTuple = [actual.cliente.latitud, actual.cliente.longitud];
      if (!cliente.current)
        cliente.current = L.circleMarker(ubicacion, {
          radius: 9, color: '#2F6BFF', fillColor: '#fff', fillOpacity: 1, weight: 3,
        }).addTo(instancia).bindTooltip('Cliente');
      else cliente.current.setLatLng(ubicacion);
    } else if (cliente.current) {
      cliente.current.remove();
      cliente.current = null;
    }
    if (!centroTecnicoFijado.current || (!centroClienteFijado.current && puntoValido(actual.cliente))) {
      const puntos: L.LatLngTuple[] = [punto];
      if (puntoValido(actual.cliente)) puntos.push([actual.cliente.latitud, actual.cliente.longitud]);
      if (puntoValido(actual.tecnico)) puntos.push([actual.tecnico.latitud, actual.tecnico.longitud]);
      if (puntos.length > 1) instancia.fitBounds(puntos, { padding: [40, 40], maxZoom: 16 });
      centroTecnicoFijado.current ||= puntoValido(actual.tecnico);
      centroClienteFijado.current ||= puntoValido(actual.cliente);
    }

    const lista = (actual.marcadores ?? []).filter(puntoValido);
    const clave = JSON.stringify(lista);
    if (clave !== claveMarcadores.current) {
      claveMarcadores.current = clave;
      marcadores.current?.remove();
      const grupoMarcadores = L.featureGroup().addTo(instancia);
      lista.forEach((marcador) => {
        L.circleMarker([marcador.latitud, marcador.longitud], {
          radius: 8,
          color: marcador.tecnico ? '#1a8754' : '#2F6BFF',
          fillOpacity: 0.9,
          weight: 2,
        }).bindTooltip(etiqueta(marcador.etiqueta || 'Servicio')).addTo(grupoMarcadores);
      });
      marcadores.current = grupoMarcadores;
      if (lista.length) {
        const limites = grupoMarcadores.getBounds();
        limites.extend(punto);
        if (tecnico.current) limites.extend(tecnico.current.getLatLng());
        instancia.fitBounds(limites, { padding: [40, 40], maxZoom: 14 });
      }
    }
    instancia.invalidateSize();
  }, [
    props.destino.latitud,
    props.destino.longitud,
    props.tecnico?.latitud,
    props.tecnico?.longitud,
    props.cliente?.latitud,
    props.cliente?.longitud,
    props.onSeleccionar,
    props.areas,
    props.etiquetaPunto,
    props.marcadores,
  ]);

  return (
    <View style={{ height: props.alto ?? 360, position: 'relative', overflow: 'hidden', borderRadius: 16 }}>
      <div ref={contenedor} className="fixly-mapa-web" role="application" aria-label="Mapa del servicio" />
      <div className="fixly-mapa-aviso" aria-live="polite">
        {errorMosaicos ? 'No se pudo cargar el fondo del mapa. Revisa tu conexión.' : mensajeMapa(props)}
      </div>
    </View>
  );
}

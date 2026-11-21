// Sin credenciales ni datos personales: únicamente coordenadas del mapa abierto
// por el usuario. Leaflet 1.9.4 fijado con integridad; proveedor configurable.
export function htmlLeaflet() {
  const tiles = process.env.EXPO_PUBLIC_MAPA_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const atribucion = process.env.EXPO_PUBLIC_MAPA_ATRIBUCION || '© OpenStreetMap contributors';
  const seguro = (v: string) => JSON.stringify(v).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="referrer" content="no-referrer">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
 integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>html,body,#mapa{height:100%;margin:0}#aviso{position:absolute;top:10px;left:55px;z-index:1000;background:white;padding:8px;font:14px sans-serif}</style>
</head><body><div id="mapa" role="application" aria-label="Mapa del servicio"></div>
<div id="aviso">Cargando mapa…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
 integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
var mapa, destino, tecnico, editable=false, centrado=false;
function valido(p){return p&&Number.isFinite(p.latitud)&&Math.abs(p.latitud)<=90&&Number.isFinite(p.longitud)&&Math.abs(p.longitud)<=180}
function avisar(p){var s=JSON.stringify(p);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage(p,'*')}
window.actualizar=function(d){
 if(!window.L||!valido(d.destino))return;
 if(!mapa){
  mapa=L.map('mapa').setView([d.destino.latitud,d.destino.longitud],15);
  L.tileLayer(${seguro(tiles)},{maxZoom:19,attribution:${seguro(atribucion)}}).addTo(mapa)
   .on('tileerror',function(){document.getElementById('aviso').textContent='No se pudo cargar el fondo del mapa.'});
  mapa.on('click',function(e){if(editable)avisar({tipo:'punto',latitud:e.latlng.lat,longitud:e.latlng.lng})});
 }
 editable=d.editable;
 var p=[d.destino.latitud,d.destino.longitud];
 if(!destino)destino=L.circleMarker(p,{radius:10,color:'#154b89',fillOpacity:1}).addTo(mapa).bindTooltip('Destino');
 else destino.setLatLng(p);
 if(valido(d.tecnico)){
  var t=[d.tecnico.latitud,d.tecnico.longitud];
  if(!tecnico)tecnico=L.circleMarker(t,{radius:9,color:'#1a8754',fillOpacity:1}).addTo(mapa).bindTooltip('Técnico');
  else tecnico.setLatLng(t);
  if(!centrado){mapa.fitBounds([p,t],{padding:[40,40],maxZoom:16});centrado=true}
 } else if(tecnico){mapa.removeLayer(tecnico);tecnico=null}
 document.getElementById('aviso').textContent=editable?'Toca el mapa para elegir el punto':'Azul: destino · Verde: técnico';
 mapa.invalidateSize();
};
window.addEventListener('message',function(e){if(e.source!==parent)return;try{window.actualizar(typeof e.data==='string'?JSON.parse(e.data):e.data)}catch(_){}});
avisar({tipo:'listo'});
</script></body></html>`;
}

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
<style>html,body,#mapa{height:100%;margin:0}#aviso{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:1000;background:rgba(16,24,40,.82);color:#fff;padding:6px 12px;border-radius:999px;font:12px sans-serif;max-width:90%;text-align:center}.pin{width:28px;height:28px;border-radius:50% 50% 50% 0;background:#2F6BFF;border:3px solid #fff;box-shadow:0 3px 10px rgba(16,24,40,.45);transform:rotate(-45deg)}.pin>i{display:block;width:8px;height:8px;margin:7px;border-radius:50%;background:#fff}</style>
</head><body><div id="mapa" role="application" aria-label="Mapa del servicio"></div>
<div id="aviso">Cargando mapa…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
 integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
var mapa, destino, tecnico, cliente, areas, extras, editable=false, centrado=false, centradoCliente=false, areasCentradas=false, claveExtras='';
function etiqueta(s){var nodo=document.createElement('span');nodo.textContent=s;return nodo}
function valido(p){return p&&Number.isFinite(p.latitud)&&Math.abs(p.latitud)<=90&&Number.isFinite(p.longitud)&&Math.abs(p.longitud)<=180}
function avisar(p){var s=JSON.stringify(p);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else parent.postMessage(p,'*')}
function pin(){return L.divIcon({className:'',html:'<div class="pin"><i></i></div>',iconSize:[28,28],iconAnchor:[14,26]})}
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
 if(!destino){
   destino=L.marker(p,{draggable:editable,icon:pin(),keyboard:false}).addTo(mapa);
   destino.on('dragend',function(e){var q=e.target.getLatLng();avisar({tipo:'punto',latitud:q.lat,longitud:q.lng})});
 } else {
   var previo=destino.getLatLng();
   destino.setLatLng(p);
   if(Math.abs(previo.lat-p[0])>1e-7||Math.abs(previo.lng-p[1])>1e-7)mapa.panTo(p);
 }
 if(destino.dragging){if(editable)destino.dragging.enable();else destino.dragging.disable()}
 destino.unbindTooltip().bindTooltip(etiqueta(d.etiquetaPunto||'Destino'));
 if(areas)mapa.removeLayer(areas);
 areas=L.featureGroup().addTo(mapa);
 (d.areas||[]).forEach(function(a){
  var estilo={color:a.propuesta?'#b36b00':'#154b89',weight:2,fillOpacity:0.12,dashArray:a.propuesta?'6 4':null},capa;
  if(a.geometria&&(a.geometria.type==='Polygon'||a.geometria.type==='MultiPolygon'))capa=L.geoJSON(a.geometria,{style:estilo});
  else if(valido(a.centro)&&Number.isFinite(a.radioMetros)&&a.radioMetros>=100&&a.radioMetros<=50000)capa=L.circle([a.centro.latitud,a.centro.longitud],Object.assign({radius:a.radioMetros},estilo));
  if(capa)capa.bindTooltip(etiqueta(a.nombre||'Cobertura')).addTo(areas);
 });
 if(!areasCentradas&&areas.getLayers().length){
  var limites=areas.getBounds();limites.extend(p);mapa.fitBounds(limites,{padding:[30,30],maxZoom:15});areasCentradas=true;
 }
 if(valido(d.tecnico)){
  var t=[d.tecnico.latitud,d.tecnico.longitud];
  if(!tecnico)tecnico=L.circleMarker(t,{radius:9,color:'#1a8754',fillOpacity:1}).addTo(mapa).bindTooltip('Técnico');
  else tecnico.setLatLng(t);
 } else if(tecnico){mapa.removeLayer(tecnico);tecnico=null}
 if(valido(d.cliente)){
  var c=[d.cliente.latitud,d.cliente.longitud];
  if(!cliente)cliente=L.circleMarker(c,{radius:9,color:'#2F6BFF',fillColor:'#fff',fillOpacity:1,weight:3}).addTo(mapa).bindTooltip('Cliente');
  else cliente.setLatLng(c);
 } else if(cliente){mapa.removeLayer(cliente);cliente=null}
 if(!centrado||(!centradoCliente&&valido(d.cliente))){
  var puntos=[p];
  if(valido(d.cliente))puntos.push([d.cliente.latitud,d.cliente.longitud]);
  if(valido(d.tecnico))puntos.push([d.tecnico.latitud,d.tecnico.longitud]);
  if(puntos.length>1)mapa.fitBounds(puntos,{padding:[40,40],maxZoom:16});
  centrado=centrado||valido(d.tecnico);
  centradoCliente=centradoCliente||valido(d.cliente);
 }
 var lista=(d.marcadores||[]).filter(valido);
 var clave=JSON.stringify(lista);
 if(clave!==claveExtras){
  claveExtras=clave;
  if(extras)mapa.removeLayer(extras);
  extras=L.featureGroup().addTo(mapa);
  lista.forEach(function(m){
   L.circleMarker([m.latitud,m.longitud],{radius:8,color:m.tecnico?'#1a8754':'#2F6BFF',fillOpacity:0.9,weight:2})
    .bindTooltip(etiqueta(m.etiqueta||'Servicio')).addTo(extras);
  });
  if(lista.length){
   var b=extras.getBounds();b.extend(p);
   if(tecnico)b.extend(tecnico.getLatLng());
   mapa.fitBounds(b,{padding:[40,40],maxZoom:14});
  }
 }
 document.getElementById('aviso').textContent=editable?'Mueve el pin o toca el mapa':lista.length?'Azul: cliente · Verde: técnico':(valido(d.cliente)||valido(d.tecnico))?'Azul: cliente · Verde: técnico':areas.getLayers().length?'Azul: cobertura vigente · Ámbar: propuesta':('Azul: '+(d.etiquetaPunto||'destino')+' · Verde: técnico');
 mapa.invalidateSize();
};
window.addEventListener('message',function(e){if(e.source!==parent)return;try{window.actualizar(typeof e.data==='string'?JSON.parse(e.data):e.data)}catch(_){}});
avisar({tipo:'listo'});
</script></body></html>`;
}

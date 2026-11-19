/** Solo guarda sección e ID. Nunca incluye datos personales, códigos o formularios. */
export function leerRutaAdmin(): { seccion: string; usuario: number | null; orden: number | null } {
  const hash = window.location.hash;
  if (!hash.startsWith('#admin/')) return { seccion: '', usuario: null, orden: null };
  const [seccion, consulta = ''] = hash.slice(7).split('?');
  const parametros = new URLSearchParams(consulta);
  return { seccion, usuario: leerId(parametros.get('usuario')), orden: leerId(parametros.get('orden')) };
}
function leerId(valor: string | null): number | null {
  const id = valor && /^\d+$/.test(valor) ? Number(valor) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
export function guardarRutaOrdenAdmin(orden: number | null) {
  const hash = `#admin/ordenes${orden ? `?orden=${orden}` : ''}`;
  window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
}
export function guardarRutaAdmin(seccion: string, usuario: number | null = null) {
  const hash = seccion ? `#admin/${encodeURIComponent(seccion)}${usuario ? `?usuario=${usuario}` : ''}` : '';
  window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
}

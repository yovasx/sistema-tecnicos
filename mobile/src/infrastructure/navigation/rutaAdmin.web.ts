/** Solo guarda sección e ID. Nunca incluye datos personales, códigos o formularios. */
export function leerRutaAdmin(): { seccion: string; usuario: number | null } {
  const hash = window.location.hash;
  if (!hash.startsWith('#admin/')) return { seccion: '', usuario: null };
  const [seccion, consulta = ''] = hash.slice(7).split('?');
  const valor = new URLSearchParams(consulta).get('usuario');
  const id = valor && /^\d+$/.test(valor) ? Number(valor) : NaN;
  return { seccion, usuario: Number.isSafeInteger(id) && id > 0 ? id : null };
}
export function guardarRutaAdmin(seccion: string, usuario: number | null = null) {
  const hash = seccion ? `#admin/${encodeURIComponent(seccion)}${usuario ? `?usuario=${usuario}` : ''}` : '';
  window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
}

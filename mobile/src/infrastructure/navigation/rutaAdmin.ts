<<<<<<< HEAD
export function leerRutaAdmin(): { seccion: string; usuario: number | null } {
  return { seccion: '', usuario: null };
}
export function guardarRutaAdmin(_seccion: string, _usuario: number | null = null) {}
=======
export function leerRutaAdmin(): { seccion: string; usuario: number | null; orden: number | null } {
  return { seccion: '', usuario: null, orden: null };
}
export function guardarRutaAdmin(_seccion: string, _usuario: number | null = null) {}
export function guardarRutaOrdenAdmin(_orden: number | null) {}
>>>>>>> main

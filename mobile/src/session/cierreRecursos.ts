// Recursos de la sesión (GPS, tareas nativas): no sobreviven al cambio de cuenta.
const cierres = new Set<() => Promise<void>>();
export function registrarCierre(recurso: () => Promise<void>) {
  cierres.add(recurso);
  return () => { cierres.delete(recurso); };
}
export async function cerrarRecursosSesion() {
  await Promise.allSettled([...cierres].map(cerrar => cerrar()));
}

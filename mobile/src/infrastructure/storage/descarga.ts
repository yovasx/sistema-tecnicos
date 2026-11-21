/** El backoffice documental está disponible solo en navegador de escritorio. */
export function guardarDescarga(_archivo: Blob, _nombre: string): void {
  throw new Error('Abre el panel administrativo en un navegador de escritorio para descargar documentos.');
}

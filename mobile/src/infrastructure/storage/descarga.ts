/** El backoffice documental está disponible solo en navegador de escritorio. */
export function guardarDescarga(_archivo: Blob, _nombre: string): void {
  throw new Error('Abrí el backoffice en un navegador de escritorio para descargar documentos.');
}

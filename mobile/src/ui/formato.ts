/**
 * Formateo de datos para la UI, en español boliviano:
 * montos "Bs 65,00", fechas cortas "2026-11-16", booleanos "Sí/No".
 */
export function bolivianos(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) {
    return '—';
  }
  return 'Bs ' + n.toFixed(2).replace('.', ',');
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  return iso.slice(0, 10);
}

export function siNo(b: boolean | null | undefined): string {
  return b ? 'Sí' : 'No';
}

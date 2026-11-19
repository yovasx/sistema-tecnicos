import { Ionicons } from '@expo/vector-icons';
import { CategoriaPublica } from '../../domain/models/Publico';

type Icono = keyof typeof Ionicons.glyphMap;

/**
 * Icono por categoría. La base no guarda iconos, así que se resuelve por
 * nombre y cualquier categoría nueva cae en el genérico de herramientas.
 */
export function iconoCategoria(nombre: string): Icono {
  const clave = nombre.toLowerCase();
  if (clave.includes('plomer') || clave.includes('agua')) return 'water';
  if (clave.includes('electric')) return 'flash';
  if (clave.includes('clima') || clave.includes('gas') || clave.includes('calef')) {
    return 'thermometer';
  }
  if (clave.includes('cerraj')) return 'key';
  if (clave.includes('limpieza')) return 'sparkles';
  return 'construct';
}

/** "Desde Bs 50,00"; null cuando la categoría todavía no tiene tarifa. */
export function desdeCategoria(categoria: CategoriaPublica): string | null {
  const tarifa = categoria.tarifaVisita;
  if (tarifa === null || tarifa === undefined) {
    return null;
  }
  return 'Desde Bs ' + tarifa.toFixed(2).replace('.', ',');
}

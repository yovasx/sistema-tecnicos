import { useCallback, useEffect, useState } from 'react';
import { CategoriaPublica } from '../../domain/models/Publico';
import { publicoRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';

interface EstadoCategorias {
  categorias: CategoriaPublica[];
  cargando: boolean;
  error: string | null;
}

/**
 * Catálogo público compartido por la bienvenida del teléfono y la landing de
 * escritorio. Si el endpoint falla, las pantallas no inventan tarifas: muestran
 * el error y ofrecen reintentar.
 */
export function useCategoriasPublicas() {
  const [estado, setEstado] = useState<EstadoCategorias>({
    categorias: [],
    cargando: true,
    error: null,
  });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));

    publicoRepository
      .categorias()
      .then((categorias) => {
        if (!vigente) return;
        setEstado({ categorias, cargando: false, error: null });
      })
      .catch((e) => {
        if (!vigente) return;
        const error = e as ErrorApi;
        setEstado({
          categorias: [],
          cargando: false,
          error: error.sinConexion
            ? 'No pudimos cargar las tarifas. Revisa tu conexión.'
            : 'No pudimos cargar las tarifas.',
        });
      });

    return () => {
      vigente = false;
    };
  }, [intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return { ...estado, recargar };
}

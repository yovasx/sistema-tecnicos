import { useCallback, useEffect, useState } from 'react';
import { CategoriaSolicitud } from '../../domain/models/SolicitudServicio';
import { solicitudesRepository } from '../../infrastructure/di';
import { ErrorApi } from '../../infrastructure/http/errores';

interface EstadoCategorias {
  categorias: CategoriaSolicitud[];
  cargando: boolean;
  error: string | null;
}

/**
 * Catálogo activo para clientes autenticados: incluye el id que necesita la
 * solicitud, sin exponer ids en la landing pública.
 */
export function useCategoriasSolicitud() {
  const [estado, setEstado] = useState<EstadoCategorias>({
    categorias: [],
    cargando: true,
    error: null,
  });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    solicitudesRepository
      .categorias()
      .then((categorias) => {
        if (vigente) setEstado({ categorias, cargando: false, error: null });
      })
      .catch((e) => {
        if (!vigente) return;
        setEstado({
          categorias: [],
          cargando: false,
          error: (e as ErrorApi).sinConexion
            ? 'No pudimos cargar las categorías. Revisá tu conexión.'
            : 'No pudimos cargar las categorías.',
        });
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return { ...estado, recargar };
}

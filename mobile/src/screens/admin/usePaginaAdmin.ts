import { useEffect, useRef, useState } from 'react';
import { PaginaAdmin } from '../../domain/models/Backoffice';

/** Consulta paginada en servidor con recarga manual y descarte de respuestas viejas. */
export function usePaginaAdmin<T>(
  consultar: (pagina: number) => Promise<PaginaAdmin<T>>,
  dependencias: readonly unknown[] = [],
) {
  const ultima = useRef(consultar);
  ultima.current = consultar;
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState<PaginaAdmin<T> | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    ultima.current(pagina)
      .then(d => { if (vigente) setDatos(d); })
      .catch(e => {
        if (vigente) setError(e instanceof Error ? e.message : 'No pudimos consultar la información.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [pagina, intento, ...dependencias]);
  return {
    datos,
    error,
    cargando,
    pagina,
    irA: setPagina,
    reiniciar: () => setPagina(0),
    actualizar: () => setIntento(n => n + 1),
  };
}

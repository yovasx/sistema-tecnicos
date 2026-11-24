import { DependencyList, useEffect, useRef, useState } from 'react';

export function useConsulta<T>(consultar: () => Promise<T>, dependencias: DependencyList = []) {
  const ultima = useRef(consultar); ultima.current = consultar;
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true; setCargando(true); setError('');
    void ultima.current().then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No pudimos consultar la información.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [intento, ...dependencias]);
  return { datos, error, cargando, actualizar: () => setIntento(n => n + 1) };
}

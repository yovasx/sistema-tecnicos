import { useEffect } from 'react';
export function useAvisoSalida(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    const avisar = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [activo]);
}

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useAvisoSalida } from './useAvisoSalida';

const Contexto = createContext({
  sucio: false, ocupado: false,
  definir: (_sucio: boolean, _ocupado: boolean) => {},
});
export function CambiosAdminProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState({ sucio: false, ocupado: false });
  const definir = useCallback((sucio: boolean, ocupado: boolean) => setEstado({ sucio, ocupado }), []);
  return <Contexto.Provider value={{ ...estado, definir }}>
    {children}
  </Contexto.Provider>;
}
export function useCambiosAdmin() { return useContext(Contexto); }
/** Protege navegación del shell y recarga/cierre del navegador, sin persistir datos. */
export function useCambiosSinGuardar(sucio: boolean, ocupado = false) {
  const { definir } = useCambiosAdmin();
  useEffect(() => {
    definir(sucio, ocupado);
    return () => definir(false, false);
  }, [sucio, ocupado, definir]);
  useAvisoSalida(sucio || ocupado);
}

import { createContext, useContext } from 'react';

export interface DestinoAdmin {
  seccion: string;
  usuario?: number;
  orden?: number;
}
export const NavegacionAdmin = createContext<(destino: DestinoAdmin) => void>(() => {});
export function useNavegacionAdmin() { return useContext(NavegacionAdmin); }

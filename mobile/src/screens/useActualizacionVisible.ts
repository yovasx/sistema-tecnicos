import { useContext, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

/** Refresca solo lecturas visibles; nunca mientras el usuario prepara una acción. */
export function useActualizacionVisible(actualizar: () => void, bloqueado: boolean, intervalo = 15000) {
  const nav = useContext(NavigationContext);
  const actual = useRef({ actualizar, bloqueado }); actual.current = { actualizar, bloqueado };
  useEffect(() => {
    const t = setInterval(() => {
      if (!actual.current.bloqueado && (nav?.isFocused() ?? true) && AppState.currentState === 'active'
        && (Platform.OS !== 'web' || !document.hidden)) actual.current.actualizar();
    }, intervalo);
    return () => clearInterval(t);
  }, [nav, intervalo]);
}

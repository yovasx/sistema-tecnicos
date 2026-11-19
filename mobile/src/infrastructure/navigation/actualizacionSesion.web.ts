/** Al volver a la pestaña, la identidad visible vuelve a consultarse al servidor. */
export function observarRegresoASesion(actualizar: () => void): () => void {
  const alVolver = () => { if (document.visibilityState === 'visible') actualizar(); };
  window.addEventListener('focus', alVolver);
  document.addEventListener('visibilitychange', alVolver);
  return () => {
    window.removeEventListener('focus', alVolver);
    document.removeEventListener('visibilitychange', alVolver);
  };
}

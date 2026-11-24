/** La ruta no contiene correo, permiso ni contraseña. */
export function esActivacionInvitada(): boolean {
  return window.location.hash === '#activar-cuenta';
}
export function salirDeActivacionInvitada(): void {
  if (esActivacionInvitada()) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

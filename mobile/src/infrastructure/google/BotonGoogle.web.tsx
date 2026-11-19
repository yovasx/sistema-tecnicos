import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { authRepository } from '../di';
import { BotonPrimario } from '../../ui/BotonPrimario';
import type { BotonGoogleProps } from './BotonGoogle';
export type { CredencialGoogle } from './BotonGoogle';

interface GoogleId {
  initialize: (opciones: { client_id: string; nonce: string; callback: (r: { credential: string }) => void; auto_select: boolean }) => void;
  renderButton: (contenedor: HTMLElement, opciones: Record<string, unknown>) => void;
}
let carga: Promise<GoogleId> | undefined;
function cargar(): Promise<GoogleId> {
  if (!carga) carga = new Promise<GoogleId>((resolve, reject) => {
    const actual = (window as unknown as { google?: { accounts: { id: GoogleId } } }).google;
    if (actual) { resolve(actual.accounts.id); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client?hl=es';
    script.async = true;
    script.onload = () => {
      const google = (window as unknown as { google?: { accounts: { id: GoogleId } } }).google;
      if (google) resolve(google.accounts.id); else reject(new Error());
    };
    script.onerror = () => { script.remove(); carga = undefined; reject(new Error()); };
    document.head.appendChild(script);
  });
  return carga;
}
export function googleDisponible() { return !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; }
export function BotonGoogle({ onCredencial, onError }: BotonGoogleProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  const recibir = useRef(onCredencial);
  const error = useRef(onError);
  recibir.current = onCredencial; error.current = onError;
  useEffect(() => {
    if (!googleDisponible()) return;
    let vigente = true;
    let enCurso = false;
    let ultimoAncho = 0;
    let observador: ResizeObserver | undefined;
    setFallo(false);
    // GIS fija el ancho al dibujar: hay que medir después del layout y volver
    // a dibujar al cambiar entre móvil y escritorio.
    const pintar = (google: GoogleId) => {
      const nodo = contenedor.current;
      if (!vigente || !nodo) return;
      const ancho = Math.floor(nodo.getBoundingClientRect().width);
      if (ancho < 1 || Math.abs(ancho - ultimoAncho) < 1) return;
      ultimoAncho = ancho;
      nodo.replaceChildren();
      google.renderButton(nodo, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', locale: 'es',
        width: Math.min(400, ancho),
      });
    };
    void Promise.all([cargar(), authRepository.desafioGoogle()]).then(([google, { nonce }]) => {
      if (!vigente || !contenedor.current) return;
      google.initialize({
        client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!, nonce, auto_select: false,
        callback: (r) => {
          if (!vigente || enCurso) return;
          enCurso = true;
          void recibir.current({ idToken: r.credential, nonce }).finally(() => {
            enCurso = false;
            if (vigente) setIntento((v) => v + 1);
          });
        },
      });
      pintar(google);
      if (typeof ResizeObserver !== 'undefined') {
        observador = new ResizeObserver(() => pintar(google));
        observador.observe(contenedor.current);
      }
    }).catch(() => {
      if (vigente) { setFallo(true); error.current('Google no está disponible. Podés ingresar con correo y contraseña.'); }
    });
    return () => {
      vigente = false;
      observador?.disconnect();
      contenedor.current?.replaceChildren();
    };
  }, [intento]);
  if (!googleDisponible()) return null;
  return <View style={{ minHeight: 44 }}>
    <div ref={contenedor} style={{ width: '100%', minHeight: 44 }} />
    {fallo ? <BotonPrimario titulo="Reintentar Google" variante="secundario" onPress={() => setIntento((v) => v + 1)} /> : null}
  </View>;
}

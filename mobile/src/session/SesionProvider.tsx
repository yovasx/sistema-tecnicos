import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DatosRegistroCliente } from '../domain/models/Registro';
import { DatosRegistroTecnico } from '../domain/models/Expediente';
import { EstadoSesion, UsuarioSesion } from '../domain/models/Sesion';
import { AuthRepository } from '../domain/repositories/AuthRepository';
import { TokenStorage } from '../domain/repositories/TokenStorage';
import {
  definirToken,
  registrarSesionVencida,
} from '../infrastructure/http/apiClient';

interface ContextoSesion {
  estado: EstadoSesion;
  usuario: UsuarioSesion | null;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  /** Alta pública de cliente; deja la sesión iniciada, igual que el login. */
  registrar: (datos: DatosRegistroCliente) => Promise<void>;
  registrarTecnico: (datos: DatosRegistroTecnico) => Promise<void>;
  iniciarGoogle: (idToken: string, nonce: string, nombre?: string, apellido?: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export interface SesionProviderProps {
  children: ReactNode;
  authRepository: AuthRepository;
  tokenStorage: TokenStorage;
}

/**
 * Estado global de sesión: `cargando` mientras se restaura, `anonimo` sin token
 * válido y `autenticado` con el usuario que devolvió `/api/auth/me`.
 *
 * El token se persiste en SecureStore (teléfono) o localStorage (web), así que
 * recargar la app en el navegador no cierra la sesión.
 */
export function SesionProvider({
  children,
  authRepository,
  tokenStorage,
}: SesionProviderProps) {
  const [estado, setEstado] = useState<EstadoSesion>('cargando');
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);

  const cerrarSesion = useCallback(async () => {
    await tokenStorage.clear();
    definirToken(null);
    setUsuario(null);
    setEstado('anonimo');
  }, [tokenStorage]);

  useEffect(() => {
    registrarSesionVencida(() => {
      void cerrarSesion();
    });
    return () => registrarSesionVencida(null);
  }, [cerrarSesion]);

  useEffect(() => {
    let vigente = true;

    (async () => {
      const token = await tokenStorage.get();
      if (!vigente) return;

      if (!token) {
        setEstado('anonimo');
        return;
      }

      definirToken(token);
      try {
        const usuarioActual = await authRepository.me();
        if (!vigente) return;
        setUsuario(usuarioActual);
        setEstado('autenticado');
      } catch {
        await tokenStorage.clear();
        definirToken(null);
        if (!vigente) return;
        setUsuario(null);
        setEstado('anonimo');
      }
    })();

    return () => {
      vigente = false;
    };
  }, [authRepository, tokenStorage]);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      const sesion = await authRepository.login(email, password);
      await tokenStorage.save(sesion.token);
      definirToken(sesion.token);
      setUsuario(sesion.usuario);
      setEstado('autenticado');
    },
    [authRepository, tokenStorage],
  );

  const registrar = useCallback(
    async (datos: DatosRegistroCliente) => {
      const sesion = await authRepository.registrar(datos);
      await tokenStorage.save(sesion.token);
      definirToken(sesion.token);
      setUsuario(sesion.usuario);
      setEstado('autenticado');
    },
    [authRepository, tokenStorage],
  );

  const registrarTecnico = useCallback(async (datos: DatosRegistroTecnico) => {
    const sesion = await authRepository.registrarTecnico(datos);
    await tokenStorage.save(sesion.token);
    definirToken(sesion.token);
    setUsuario(sesion.usuario);
    setEstado('autenticado');
  }, [authRepository, tokenStorage]);

  const iniciarGoogle = useCallback(async (idToken: string, nonce: string, nombre?: string, apellido?: string) => {
    const sesion = await authRepository.google(idToken, nonce, nombre, apellido);
    await tokenStorage.save(sesion.token);
    definirToken(sesion.token); setUsuario(sesion.usuario); setEstado('autenticado');
  }, [authRepository, tokenStorage]);
  const valor = useMemo(
    () => ({ estado, usuario, iniciarSesion, registrar, registrarTecnico, iniciarGoogle, cerrarSesion }),
    [estado, usuario, iniciarSesion, registrar, registrarTecnico, iniciarGoogle, cerrarSesion],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de <SesionProvider>.');
  }
  return contexto;
}

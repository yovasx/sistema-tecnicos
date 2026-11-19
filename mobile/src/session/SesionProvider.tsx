import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DatosRegistroCliente } from '../domain/models/Registro';
import { DatosRegistroTecnico } from '../domain/models/Expediente';
import { EstadoSesion, UsuarioSesion } from '../domain/models/Sesion';
import { AuthRepository } from '../domain/repositories/AuthRepository';
import { TokenStorage } from '../domain/repositories/TokenStorage';
import { observarRegresoASesion } from '../infrastructure/navigation/actualizacionSesion';
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
  /** Refresca solo la identidad autenticada; nunca recibe la ficha de otro usuario. */
  refrescarUsuario: () => Promise<boolean>;
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
  const generacion = useRef(0);
  const identidad = useRef<number | null>(null);

  const cerrarSesion = useCallback(async () => {
    ++generacion.current;
    identidad.current = null;
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
    const turno = generacion.current;

    (async () => {
      const token = await tokenStorage.get();
      if (!vigente || turno !== generacion.current) return;

      if (!token) {
        setEstado('anonimo');
        return;
      }

      definirToken(token);
      try {
        const usuarioActual = await authRepository.me();
        if (!vigente || turno !== generacion.current) return;
        setUsuario(usuarioActual);
        identidad.current = usuarioActual.id;
        setEstado('autenticado');
      } catch {
        await tokenStorage.clear();
        definirToken(null);
        if (!vigente || turno !== generacion.current) return;
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
      const turno = ++generacion.current;
      const sesion = await authRepository.login(email, password);
      if (turno !== generacion.current) return;
      await tokenStorage.save(sesion.token);
      definirToken(sesion.token);
      setUsuario(sesion.usuario);
      identidad.current = sesion.usuario.id;
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
      ++generacion.current;
      identidad.current = sesion.usuario.id;
      setEstado('autenticado');
    },
    [authRepository, tokenStorage],
  );

  const registrarTecnico = useCallback(async (datos: DatosRegistroTecnico) => {
    const sesion = await authRepository.registrarTecnico(datos);
    await tokenStorage.save(sesion.token);
    definirToken(sesion.token);
    setUsuario(sesion.usuario);
    ++generacion.current;
    identidad.current = sesion.usuario.id;
    setEstado('autenticado');
  }, [authRepository, tokenStorage]);

  const iniciarGoogle = useCallback(async (idToken: string, nonce: string, nombre?: string, apellido?: string) => {
    const sesion = await authRepository.google(idToken, nonce, nombre, apellido);
    await tokenStorage.save(sesion.token);
    ++generacion.current;
    identidad.current = sesion.usuario.id;
    definirToken(sesion.token); setUsuario(sesion.usuario); setEstado('autenticado');
  }, [authRepository, tokenStorage]);
  const refrescarUsuario = useCallback(async () => {
    const turno = generacion.current;
    const id = identidad.current;
    if (id === null) return false;
    try {
      const actual = await authRepository.me();
      if (turno !== generacion.current || identidad.current !== id || actual.id !== id) return false;
      setUsuario(actual);
      return true;
    } catch {
      return false;
    }
  }, [authRepository]);
  useEffect(() => {
    if (estado !== 'autenticado') return;
    return observarRegresoASesion(() => { void refrescarUsuario(); });
  }, [estado, refrescarUsuario]);
  const valor = useMemo(
    () => ({ estado, usuario, iniciarSesion, registrar, registrarTecnico, iniciarGoogle, cerrarSesion, refrescarUsuario }),
    [estado, usuario, iniciarSesion, registrar, registrarTecnico, iniciarGoogle, cerrarSesion, refrescarUsuario],
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

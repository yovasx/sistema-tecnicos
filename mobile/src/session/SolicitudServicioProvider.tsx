import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useRef,
  useState,
} from 'react';
import * as Crypto from 'expo-crypto';
import { EvidenciaServicio, ResultadoSolicitud } from '../domain/models/SolicitudServicio';
import { solicitudesRepository } from '../infrastructure/di';
import { ErrorApi } from '../infrastructure/http/errores';

export interface BorradorSolicitud {
  categoria: number | null;
  descripcion: string;
  latitud: string;
  longitud: string;
  referencia: string;
  urgencia: boolean;
  evidencia?: EvidenciaServicio;
}

const vacio: BorradorSolicitud = {
  categoria: null,
  descripcion: '',
  latitud: '',
  longitud: '',
  referencia: '',
  urgencia: false,
};

export function borradorVacio(categoria: number | null = null): BorradorSolicitud {
  return { ...vacio, categoria };
}

interface ContextoSolicitud {
  abierta: boolean;
  abrir: (categoria?: number) => void;
  cerrar: () => void;
  borrador: BorradorSolicitud;
  cambiar: Dispatch<SetStateAction<BorradorSolicitud>>;
  paso: number;
  ir: (paso: number) => void;
  ocupado: boolean;
  /** El envío falló sin confirmación: el reintento debe conservar la misma clave. */
  incierto: boolean;
  resultado: ResultadoSolicitud | null;
  error: string;
  /** Sube cuando se crea una solicitud para que Mis servicios vuelva a consultar. */
  recarga: number;
  enviar: () => Promise<void>;
}

const Contexto = createContext<ContextoSolicitud | null>(null);

/**
 * Borrador de la solicitud de servicio.
 *
 * <p>Vive solo en memoria y se reinicia al cerrar sesión (el provider lleva
 * `key={usuario.id}`). La clave de envío se conserva durante los reintentos para
 * que el backend no cree dos órdenes si la respuesta se pierde.</p>
 */
export function SolicitudServicioProvider({ children }: { children: ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  const [borrador, setBorrador] = useState<BorradorSolicitud>(vacio);
  const [paso, setPaso] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSolicitud | null>(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const bloqueo = useRef(false);
  const clave = useRef<string | null>(null);

  function cerrar() {
    if (bloqueo.current) return;
    setAbierta(false);
    setBorrador(vacio);
    setPaso(0);
    setResultado(null);
    setError('');
    setIncierto(false);
    clave.current = null;
  }

  async function enviar() {
    if (bloqueo.current || resultado || !borrador.categoria) return;
    bloqueo.current = true;
    setOcupado(true);
    setError('');
    try {
      clave.current ??= Crypto.randomUUID();
      const r = await solicitudesRepository.crear({
        clave: clave.current,
        categoria: borrador.categoria,
        descripcion: borrador.descripcion.trim(),
        referencia: borrador.referencia.trim(),
        latitud: Number(borrador.latitud),
        longitud: Number(borrador.longitud),
        urgencia: borrador.urgencia,
        evidencia: borrador.evidencia,
      });
      setResultado(r);
      setIncierto(false);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos confirmar tu solicitud.');
      // Sin respuesta del servidor (o 5xx) el alta pudo haberse guardado.
      setIncierto(
        !(e instanceof ErrorApi) ||
          !e.estado ||
          e.estado >= 500 ||
          e.codigo === 'CLAVE_SOLICITUD_REUTILIZADA',
      );
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }

  return (
    <Contexto.Provider
      value={{
        abierta,
        borrador,
        paso,
        ocupado,
        incierto,
        resultado,
        error,
        recarga,
        enviar,
        cerrar,
        abrir: (categoria) => {
          if (bloqueo.current) return;
          if (resultado) {
            setBorrador(borradorVacio(categoria ?? null));
            setResultado(null);
            setPaso(0);
            setIncierto(false);
            clave.current = null;
          } else if (categoria) {
            setBorrador((b) => ({ ...b, categoria }));
          }
          setError('');
          setAbierta(true);
        },
        cambiar: (valor) => {
          if (!bloqueo.current && !incierto) setBorrador(valor);
        },
        ir: (valor) => {
          if (!bloqueo.current && !incierto) {
            setPaso(valor);
            setError('');
          }
        },
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useSolicitudServicio(): ContextoSolicitud {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('Falta SolicitudServicioProvider.');
  }
  return contexto;
}

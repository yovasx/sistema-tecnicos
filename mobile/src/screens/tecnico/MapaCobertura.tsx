import { useEffect, useRef, useState } from 'react';
import { Cobertura, Pertenencia, PuntoCobertura, ZonaPropuesta } from '../../domain/models/Cobertura';
import { coberturaRepository } from '../../infrastructure/di';
import { muestraUbicacionActual } from '../../infrastructure/ubicacion/ubicacionActual';
import { Mapa } from '../../ui/mapa/Mapa';
import { PuntoMapa, AreaMapa } from '../../ui/mapa/contrato';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { fechaHoraBolivia } from '../../ui/formato';

export function areasCobertura(c: Cobertura, propuestas: ZonaPropuesta[] = []): AreaMapa[] {
  return [...c.zonas.map(z => ({ nombre: z.nombre, geometria: z.geometria })),
    ...propuestas.map(z => ({ nombre: z.nombre, centro: z, radioMetros: z.radioMetros, propuesta: true }))];
}
export function centroCobertura(c: Cobertura): PuntoMapa {
  const z = c.zonas[0];
  if (z?.latitud != null && z.longitud != null) return { latitud: z.latitud, longitud: z.longitud };
  const p = z?.geometria.type === 'Polygon' ? z.geometria.coordinates[0]?.[0] : z?.geometria.coordinates[0]?.[0]?.[0];
  return p ? { latitud: p[1], longitud: p[0] } : { latitud: -16.5, longitud: -68.13 };
}
const estados = {
  dentro: 'Dentro de tu cobertura', fuera: 'Fuera de tu cobertura', cerca_limite: 'Cerca del límite: la precisión no permite asegurarlo',
  ubicacion_insuficiente: 'Ubicación insuficiente: solicita otra muestra', sin_cobertura: 'Sin cobertura vigente',
};
export function MapaCobertura({ datos, propuestas = [], comprobar = false }: {
  datos: Cobertura; propuestas?: ZonaPropuesta[]; comprobar?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [punto, setPunto] = useState<PuntoCobertura | null>(null);
  const [resultado, setResultado] = useState<Pertenencia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const generacion = useRef(0);
  const bloqueo = useRef(false);
  useEffect(() => {
    generacion.current++; setPunto(null); setResultado(null);
    return () => { generacion.current++; };
  }, [datos.revision]);
  useEffect(() => {
    if (!punto) return;
    const t = setTimeout(() => { setPunto(null); setResultado(null); }, Math.max(0, 30000 - (Date.now() - Date.parse(punto.capturadoEn))));
    return () => clearTimeout(t);
  }, [punto]);
  async function ubicar() {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError(''); setPunto(null); setResultado(null);
    const g = generacion.current;
    try {
      const p = await muestraUbicacionActual();
      const r = await coberturaRepository.comprobar(p);
      if (g !== generacion.current) return;
      if (r.revision !== datos.revision) throw new Error('Tu cobertura cambió. Actualiza antes de comprobarla.');
      setPunto(p); setResultado(r);
    } catch (e) { if (g === generacion.current) setError(e instanceof Error ? e.message : 'No pudimos comprobar tu ubicación.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <>
    <Texto variante="caption">El mapa consulta proveedores externos solo al abrirlo. Azul: polígonos vigentes. Ámbar: propuesta aproximada, todavía sin efecto.</Texto>
    <BotonPrimario titulo={abierto ? 'Cerrar mapa de cobertura' : 'Abrir mapa de cobertura'} variante="secundario" onPress={() => setAbierto(v => !v)} />
    {abierto ? <Mapa destino={punto ?? centroCobertura(datos)} etiquetaPunto={punto ? 'Mi ubicación puntual' : 'Punto de referencia'}
      areas={areasCobertura(datos, propuestas)} /> : null}
    {comprobar ? <>
      <Texto>Consulta puntual: se enviará el punto a Fixly para comprobar el área, sin guardarlo ni compartirlo con clientes.
        No activa el seguimiento ni cambia tu disponibilidad.</Texto>
      <BotonPrimario titulo="Comprobar mi ubicación en la cobertura" variante="secundario" cargando={ocupado} onPress={() => void ubicar()} />
      {error ? <Aviso tono="peligro">{error}</Aviso> : null}
      {resultado && punto ? <Aviso tono={resultado.estado === 'dentro' ? 'exito' : 'advertencia'}>
        {estados[resultado.estado]}. Muestra: {fechaHoraBolivia(punto.capturadoEn)}. Precisión: {punto.precision == null ? 'no disponible' : `${Math.round(punto.precision)} m`}.
        {resultado.distanciaLimiteMetros != null ? ` Distancia al límite: ${Math.round(resultado.distanciaLimiteMetros)} m.` : ''}
        {' '}Caduca a los 30 segundos. Estar fuera no cancela servicios asignados.
      </Aviso> : <Texto variante="caption">Sin una muestra GPS reciente no se afirma si estás dentro o fuera.</Texto>}
    </> : null}
  </>;
}

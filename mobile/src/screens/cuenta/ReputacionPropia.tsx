import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Reputacion } from '../../domain/models/Hogar';
import { hogarRepository } from '../../infrastructure/di';
import { Aviso } from '../../ui/Aviso';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { fechaHoraBolivia } from '../../ui/formato';

export function ReputacionPropia() {
  const [datos, setDatos] = useState<Reputacion | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    hogarRepository.reputacion().then(d => { if (vigente) { setDatos(d); setError(''); } })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No pudimos cargar las valoraciones.'); });
    return () => { vigente = false; };
  }, [intento]);
  return <Tarjeta style={{ gap: 12 }}>
    <Texto variante="subtitulo">Mi historial y valoraciones</Texto>
    {error ? <Aviso tono="peligro">{error}</Aviso> : !datos ? <ActivityIndicator /> : <>
      <Texto variante="titulo">{datos.total ? `${datos.promedio.toFixed(1)} / 5` : 'Sin calificaciones todavía'}</Texto>
      <Texto>{datos.total} valoraciones recibidas · {datos.ordenesFinalizadas} servicios finalizados · {datos.ordenesCanceladas} cancelados</Texto>
      <Texto variante="caption">Últimas 20 valoraciones recibidas. Los comentarios de esta sección son privados; no son reseñas públicas.</Texto>
      {datos.recibidas.map(c => <Tarjeta key={c.id} style={{ gap: 6 }}>
        <Texto variante="cuerpoFuerte">{c.puntaje} / 5 · {c.categoria}</Texto>
        <Texto>{c.comentario || 'Sin comentario'}</Texto>
        <Texto variante="caption">{c.autor || 'Cuenta no disponible'} · {fechaHoraBolivia(c.registradoEn)}</Texto>
      </Tarjeta>)}
    </>}
    <BotonPrimario titulo="Actualizar valoraciones" variante="secundario" onPress={() => setIntento(n => n + 1)} />
  </Tarjeta>;
}

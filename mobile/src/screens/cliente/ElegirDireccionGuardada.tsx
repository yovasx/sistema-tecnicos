import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Direccion } from '../../domain/models/Hogar';
import { hogarRepository } from '../../infrastructure/di';
import { Texto } from '../../ui/Texto';
import { BotonPrimario } from '../../ui/BotonPrimario';

/** Elegir copia el texto y el punto al borrador; no enlaza datos mutables. */
export function ElegirDireccionGuardada({ bloqueado, onElegir }: {
  bloqueado: boolean; onElegir: (d: Direccion) => void;
}) {
  const [lista, setLista] = useState<Direccion[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let vigente = true;
    hogarRepository.direcciones().then(d => { if (vigente) setLista(d); })
      .catch(() => { if (vigente) setError('No pudimos cargar tus direcciones. Puedes ingresar una manualmente.'); });
    return () => { vigente = false; };
  }, []);
  return <View style={{ gap: 8 }}>
    {error ? <Texto>{error}</Texto> : null}
    {lista.length ? <Texto variante="subtitulo">Usar una dirección guardada</Texto> : null}
    {lista.map(d => <BotonPrimario key={d.id}
      titulo={`${d.etiqueta}${d.predeterminada ? ' · Predeterminada' : ''}: ${d.referencia}`}
      variante="secundario" deshabilitado={bloqueado} onPress={() => onElegir(d)} />)}
  </View>;
}

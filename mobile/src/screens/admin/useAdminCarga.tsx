import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Texto } from '../../ui/Texto';
import { colores } from '../../theme/tokens';

interface Carga<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
}

/**
 * Carga asíncrona única para las pantallas del backoffice: mientras llega la
 * respuesta muestra un spinner, y si falla devuelve el mensaje del backend.
 * El repositorio es estable, así que el efecto corre una sola vez.
 */
export function useAdminCarga<T>(cargar: () => Promise<T>): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    cargar()
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setCargando(false);
      })
      .catch((e) => {
        if (!vigente) return;
        setError(e instanceof Error ? e.message : 'Error desconocido');
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // El repositorio es único; cargar no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { datos, cargando, error };
}

/** Centrado mientras cargan los datos del backoffice. */
export function CargandoAdmin() {
  return (
    <View style={estilos.cargando}>
      <ActivityIndicator color={colores.marca} size="large" />
    </View>
  );
}

/** Error de lectura del endpoint, con el mensaje real del backend. */
export function ErrorAdmin({ mensaje }: { mensaje: string }) {
  return (
    <View style={estilos.cargando}>
      <Texto variante="etiqueta" color={colores.peligro}>
        No se pudieron cargar los datos
      </Texto>
      <Texto variante="caption">{mensaje}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  cargando: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
});

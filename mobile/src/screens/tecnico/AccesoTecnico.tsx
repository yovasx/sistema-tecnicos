import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Expediente } from '../../domain/models/Expediente';
import { tecnicoRepository } from '../../infrastructure/di';
import { useSesion } from '../../session/SesionProvider';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { colores } from '../../theme/tokens';
import { OnboardingTecnicoScreen } from './OnboardingTecnicoScreen';
const ContextoExpediente = createContext<Expediente | null>(null);
export function useExpedienteTecnico() { return useContext(ContextoExpediente); }

/** La sesión persiste, pero solo el técnico aprobado accede al panel operativo. */
export function AccesoTecnico({ children }: { children: ReactNode }) {
  const { cerrarSesion } = useSesion();
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setExpediente(await tecnicoRepository.expediente()); }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos consultar tu expediente.'); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  if (cargando) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colores.marca} /></View>;
  if (error || !expediente) return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Aviso tono="peligro" titulo="No pudimos consultar tu validación">{error}</Aviso>
      <BotonPrimario titulo="Reintentar" onPress={() => void cargar()} />
      <BotonPrimario titulo="Cerrar sesión" variante="secundario" onPress={() => void cerrarSesion()} />
    </View>
  );
  if (expediente.estadoExpediente === 'aprobado') return (
    <ContextoExpediente.Provider value={expediente}>{children}</ContextoExpediente.Provider>
  );
  return <OnboardingTecnicoScreen expediente={expediente} onCambiar={setExpediente} onActualizar={cargar} />;
}

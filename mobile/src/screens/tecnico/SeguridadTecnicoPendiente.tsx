import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { PerfilPropio } from '../../domain/models/Perfil';
import { perfilRepository } from '../../infrastructure/di';
import { useSesion } from '../../session/SesionProvider';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';
import { Tarjeta } from '../../ui/Tarjeta';
import { Texto } from '../../ui/Texto';
import { VincularGoogle } from '../auth/VincularGoogle';
import { MarcoPublico } from '../publico/MarcoPublico';

/** Permite vincular una cuenta existente sin desbloquear ni alterar el expediente. */
export function SeguridadTecnicoPendiente({ onVolver }: { onVolver: () => void }) {
  const { usuario } = useSesion();
  const [cuenta, setCuenta] = useState<PerfilPropio | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [vinculando, setVinculando] = useState(false);
  const turno = useRef(0);
  const cargar = useCallback(async () => {
    const actual = ++turno.current;
    setCargando(true); setError('');
    try {
      const perfil = await perfilRepository.propio();
      if (actual === turno.current && perfil.id === usuario?.id) setCuenta(perfil);
    } catch (e) {
      if (actual === turno.current) setError(e instanceof Error ? e.message : 'No pudimos consultar tu método de acceso.');
    } finally { if (actual === turno.current) setCargando(false); }
  }, [usuario?.id]);
  useEffect(() => { void cargar(); return () => { turno.current++; }; }, [cargar]);
  return <MarcoPublico><ScrollView keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
    <View style={{ width: '100%', maxWidth: 720, gap: 20 }}>
      <BotonPrimario titulo="Volver al expediente" variante="secundario"
        deshabilitado={vinculando || cargando} onPress={onVolver} />
      <Texto variante="titulo">Acceso y seguridad</Texto>
      <Aviso>Google es un método de acceso. Vincularlo no cambia tu rol, documentos,
        estado de revisión ni aprobación técnica. Los datos guardados del expediente se conservan.</Aviso>
      {error ? <><Aviso tono="peligro">{error}</Aviso>
        <BotonPrimario titulo="Reintentar acceso y seguridad" onPress={() => void cargar()} /></> : null}
      {cargando ? <ActivityIndicator /> : cuenta ? <Tarjeta style={{ gap: 16 }}>
        <Texto variante="subtitulo">{cuenta.nombre} {cuenta.apellido}</Texto>
        <Texto>{cuenta.email}</Texto>
        <Texto>Método de acceso: {cuenta.acceso === 'google' ? 'Google' :
          cuenta.acceso === 'google_y_password' ? 'Google y contraseña Fixly' : 'Contraseña Fixly'}</Texto>
        {cuenta.acceso === 'password' ? <VincularGoogle onInteraccion={setVinculando}
          onVinculado={() => { void cargar(); }} /> :
          <Aviso>{cuenta.acceso === 'google' ?
            'Usa Continuar con Google y la misma cuenta para retomar tu expediente. No tienes una contraseña Fixly.' :
            'Google ya está vinculado. Puedes ingresar con Google o con tu contraseña Fixly.'}</Aviso>}
      </Tarjeta> : null}
    </View>
  </ScrollView></MarcoPublico>;
}

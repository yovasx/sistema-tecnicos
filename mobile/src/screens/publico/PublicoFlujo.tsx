import { useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { TipoCliente } from '../../domain/models/Sesion';
import { useResponsive } from '../../theme/responsive';
import { LoginScreen } from '../auth/LoginScreen';
import { BienvenidaMovilScreen } from './BienvenidaMovilScreen';
import { LandingPublicaScreen } from './LandingPublicaScreen';
import { LoginDesktopScreen } from './LoginDesktopScreen';
import { RegistroScreen } from './RegistroScreen';
import { TipoCuentaScreen } from './TipoCuentaScreen';
import { RecuperacionScreen } from '../auth/RecuperacionScreen';

type Vista = 'bienvenida' | 'tipoCuenta' | 'registro' | 'tecnico' | 'login' | 'recuperacion';

/**
 * Flujo público compartido por teléfono y escritorio:
 * bienvenida → tipo de cuenta → registro → sesión, con login en paralelo.
 *
 * La composición cambia según el ancho (landing rica en escritorio, bienvenida
 * compacta en el teléfono), pero el recorrido y los datos son los mismos.
 */
export function PublicoFlujo() {
  const { esDesktop } = useResponsive();
  const [vista, setVista] = useState<Vista>('bienvenida');
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('persona');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (vista !== 'tipoCuenta' && vista !== 'login') return;

    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      setVista('bienvenida');
      return true;
    });
    return () => suscripcion.remove();
  }, [vista]);

  if (vista === 'bienvenida') {
    return esDesktop ? (
      <LandingPublicaScreen
        onEntrar={() => setVista('login')}
        onCrearCuenta={() => setVista('tipoCuenta')}
        onSoyTecnico={() => setVista('tecnico')}
      />
    ) : (
      <BienvenidaMovilScreen
        onCrearCuenta={() => setVista('tipoCuenta')}
        onEntrar={() => setVista('login')}
        onSoyTecnico={() => setVista('tecnico')}
      />
    );
  }

  if (vista === 'tipoCuenta') {
    return (
      <TipoCuentaScreen
        onVolver={() => setVista('bienvenida')}
        onElegir={(tipo) => {
          setTipoCliente(tipo);
          setVista('registro');
        }}
        onEntrar={() => setVista('login')}
        onTecnico={() => setVista('tecnico')}
      />
    );
  }

  if (vista === 'registro' || vista === 'tecnico') {
    return (
      <RegistroScreen
        tipoCliente={vista === 'tecnico' ? 'persona' : tipoCliente}
        tecnico={vista === 'tecnico'}
        onVolver={() => setVista('tipoCuenta')}
        onEntrar={() => setVista('login')}
      />
    );
  }

  if (vista === 'recuperacion') return <RecuperacionScreen onEntrar={() => setVista('login')} />;

  return (
    <LoginScreen
      onVolver={() => setVista('bienvenida')}
      onCrearCuenta={() => setVista('tipoCuenta')}
      onRecuperar={() => setVista('recuperacion')}
    />
  );
}

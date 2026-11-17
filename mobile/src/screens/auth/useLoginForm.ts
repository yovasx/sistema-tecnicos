import { useState } from 'react';
import { ErrorApi } from '../../infrastructure/http/errores';
import { useSesion } from '../../session/SesionProvider';

/**
 * Estado del formulario de login, compartido por la pantalla del teléfono
 * (F03) y la de escritorio (W63): email, contraseña y el error traducido.
 */
export function useLoginForm() {
  const { iniciarSesion } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState<string | null>(null);

  const manejarSubmit = async () => {
    setErrorLogin(null);
    try {
      await iniciarSesion(email.trim(), password);
    } catch (e) {
      const error = e as ErrorApi;
      if (error.codigo === 'CREDENCIALES_INVALIDAS' || error.codigo === 'CUENTA_INACTIVA') {
        setErrorLogin(error.message);
      } else if (error.sinConexion) {
        setErrorLogin('Sin conexión: revisá IP, puerto y firewall');
      } else {
        setErrorLogin(error.message);
      }
    }
  };

  return { email, setEmail, password, setPassword, errorLogin, manejarSubmit };
}

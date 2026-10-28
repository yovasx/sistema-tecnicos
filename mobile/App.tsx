import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { apiClient } from './src/infrastructure/http/apiClient';

export default function App() {
  const [estado, setEstado] = useState('Probando conexión...');

  useEffect(() => {
    apiClient.get('/api/ping')
      .then(() => setEstado('SE CONECTO WACHIN'))
      .catch((e) => {
        if (e.response) {
          setEstado(`Hay conexión: el backend respondió ${e.response.status}`);
        } else {
          setEstado('Sin conexión: revisa IP, puerto y firewall');
        }
      });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>{estado}</Text>
    </View>
  );
}
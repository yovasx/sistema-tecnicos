import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSesion } from '../session/SesionProvider';
import { esClienteEmpresa } from '../domain/models/Sesion';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { InicioCliente } from '../screens/cliente/InicioCliente';
import { MisServicios } from '../screens/cliente/MisServicios';
import { NotificacionesCliente } from '../screens/cliente/NotificacionesCliente';
import { PerfilCliente } from '../screens/cliente/PerfilCliente';
import { InicioEmpresa } from '../screens/empresa/InicioEmpresa';
import { OrdenesEmpresa } from '../screens/empresa/OrdenesEmpresa';
import { FacturacionEmpresa } from '../screens/empresa/FacturacionEmpresa';
import { PerfilEmpresa } from '../screens/empresa/PerfilEmpresa';
import { PanelTecnico } from '../screens/tecnico/PanelTecnico';
import { ServiciosTecnico } from '../screens/tecnico/ServiciosTecnico';
import { BilleteraTecnico } from '../screens/tecnico/BilleteraTecnico';
import { PerfilTecnico } from '../screens/tecnico/PerfilTecnico';
import { AdminScreen } from '../screens/admin/AdminScreen';
import { Texto } from '../ui/Texto';
import { colores } from '../theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONOS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Inicio: 'home',
  Servicios: 'construct',
  Notificaciones: 'notifications',
  Perfil: 'person',
  Ordenes: 'receipt',
  Facturacion: 'card',
  Panel: 'speedometer',
  Billetera: 'wallet',
  Admin: 'settings',
};

/**
 * Navegación raíz.
 *
 * `cargando` → splash; `anonimo` → stack con el login; `autenticado` → tabs
 * según el rol y el perfil de cliente (persona o empresa).
 */
export function RootNavigator() {
  const { estado } = useSesion();

  return (
    <NavigationContainer>
      <View style={estilos.raiz}>
        {estado === 'cargando' ? (
          <View style={estilos.splash}>
            <Texto variante="display" color={colores.marca}>
              Fixly
            </Texto>
          </View>
        ) : estado === 'autenticado' ? (
          <RootTabs />
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </View>
    </NavigationContainer>
  );
}

function RootTabs() {
  const { usuario } = useSesion();
  const rol = usuario?.rol ?? 'cliente';
  const empresa = esClienteEmpresa(usuario);

  if (rol === 'cliente') {
    return empresa ? <TabsEmpresa /> : <TabsClientePersona />;
  }
  if (rol === 'tecnico') {
    return <TabsTecnico />;
  }
  return <TabsAdmin />;
}

function TabsClientePersona() {
  return (
    <Tab.Navigator screenOptions={opcionesTabs}>
      <Tab.Screen name="Inicio" component={InicioCliente} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Servicios" component={MisServicios} options={{ title: 'Servicios' }} />
      <Tab.Screen
        name="Notificaciones"
        component={NotificacionesCliente}
        options={{ title: 'Notif.' }}
      />
      <Tab.Screen name="Perfil" component={PerfilCliente} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function TabsEmpresa() {
  return (
    <Tab.Navigator screenOptions={opcionesTabs}>
      <Tab.Screen name="Inicio" component={InicioEmpresa} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Ordenes" component={OrdenesEmpresa} options={{ title: 'Órdenes' }} />
      <Tab.Screen
        name="Facturacion"
        component={FacturacionEmpresa}
        options={{ title: 'Facturación' }}
      />
      <Tab.Screen name="Perfil" component={PerfilEmpresa} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function TabsTecnico() {
  return (
    <Tab.Navigator screenOptions={opcionesTabs}>
      <Tab.Screen name="Panel" component={PanelTecnico} options={{ title: 'Panel' }} />
      <Tab.Screen name="Servicios" component={ServiciosTecnico} options={{ title: 'Servicios' }} />
      <Tab.Screen name="Billetera" component={BilleteraTecnico} options={{ title: 'Billetera' }} />
      <Tab.Screen name="Perfil" component={PerfilTecnico} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function TabsAdmin() {
  return (
    <Tab.Navigator screenOptions={opcionesTabs}>
      <Tab.Screen name="Admin" component={AdminScreen} options={{ title: 'Panel' }} />
    </Tab.Navigator>
  );
}

const opcionesTabs = ({ route }: { route: { name: string } }) => ({
  tabBarActiveTintColor: colores.marca,
  tabBarInactiveTintColor: colores.secundario,
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={ICONOS[route.name] ?? 'ellipse'} color={color} size={size} />
  ),
  tabBarStyle: {
    height: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.linea,
    backgroundColor: colores.superficie,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  headerShown: false,
});

const estilos = StyleSheet.create({
  raiz: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

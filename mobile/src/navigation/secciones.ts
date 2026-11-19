import { ComponentType } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import { DashboardAdminScreen } from '../screens/admin/DashboardAdminScreen';
import { UsuariosAdminScreen } from '../screens/admin/UsuariosAdminScreen';
import { CatalogoAdminScreen } from '../screens/admin/CatalogoAdminScreen';
import { ValidacionAdminScreen } from '../screens/admin/ValidacionAdminScreen';
import { TecnicosAdminScreen } from '../screens/admin/TecnicosAdminScreen';
import { OrdenesAdminScreen } from '../screens/admin/OrdenesAdminScreen';
import {
  MapaAdminScreen,
  DisputasAdminScreen,
  AuditoriaAdminScreen,
  PagosAdminScreen,
  LiquidacionesAdminScreen,
  ReportesAdminScreen,
  NotificacionesAdminScreen,
  ModeracionChatAdminScreen,
  ConfiguracionAdminScreen,
  SoporteAdminScreen,
  PenalizacionesAdminScreen,
} from '../screens/admin/PantallasAdminPendientes';

export interface Seccion {
  clave: string;
  titulo: string;
  icono: keyof typeof Ionicons.glyphMap;
  pantalla: ComponentType;
  grupo?: string;
}

/**
 * Una sola lista de secciones por rol y perfil: alimenta el sidebar de
 * escritorio. En el teléfono se siguen usando las tabs, con el mismo orden.
 */
export function seccionesClientePersona(): Seccion[] {
  return [
    { clave: 'inicio', titulo: 'Inicio', icono: 'home', pantalla: InicioCliente },
    { clave: 'servicios', titulo: 'Servicios', icono: 'construct', pantalla: MisServicios },
    {
      clave: 'notificaciones',
      titulo: 'Notificaciones',
      icono: 'notifications',
      pantalla: NotificacionesCliente,
    },
    { clave: 'perfil', titulo: 'Perfil', icono: 'person', pantalla: PerfilCliente },
  ];
}

export function seccionesEmpresa(): Seccion[] {
  return [
    { clave: 'inicio', titulo: 'Inicio', icono: 'home', pantalla: InicioEmpresa },
    { clave: 'ordenes', titulo: 'Órdenes', icono: 'receipt', pantalla: OrdenesEmpresa },
    { clave: 'facturacion', titulo: 'Facturación', icono: 'card', pantalla: FacturacionEmpresa },
    { clave: 'perfil', titulo: 'Perfil', icono: 'person', pantalla: PerfilEmpresa },
  ];
}

export function seccionesTecnico(): Seccion[] {
  return [
    { clave: 'panel', titulo: 'Panel', icono: 'speedometer', pantalla: PanelTecnico },
    { clave: 'servicios', titulo: 'Servicios', icono: 'construct', pantalla: ServiciosTecnico },
    { clave: 'billetera', titulo: 'Billetera', icono: 'wallet', pantalla: BilleteraTecnico },
    { clave: 'perfil', titulo: 'Perfil', icono: 'person', pantalla: PerfilTecnico },
  ];
}

/** W42–W61: secciones del backoffice, incluido el directorio técnico W61. */
export function seccionesAdmin(): Seccion[] {
  const secciones: Seccion[] = [
    { clave: 'dashboard', titulo: 'Dashboard', icono: 'grid', pantalla: DashboardAdminScreen },
    { clave: 'ordenes', titulo: 'Órdenes', icono: 'receipt', pantalla: OrdenesAdminScreen },
    { clave: 'mapa', titulo: 'Mapa en vivo', icono: 'map', pantalla: MapaAdminScreen },
    { clave: 'usuarios', titulo: 'Usuarios', icono: 'people', pantalla: UsuariosAdminScreen },
    { clave: 'tecnicos', titulo: 'Técnicos', icono: 'construct', pantalla: TecnicosAdminScreen },
    {
      clave: 'validacion',
      titulo: 'Validar técnicos',
      icono: 'checkmark-circle',
      pantalla: ValidacionAdminScreen,
    },
    { clave: 'disputas', titulo: 'Disputas', icono: 'warning', pantalla: DisputasAdminScreen },
    { clave: 'auditoria', titulo: 'Auditoría', icono: 'document-text', pantalla: AuditoriaAdminScreen },
    { clave: 'catalogo', titulo: 'Catálogo', icono: 'list', pantalla: CatalogoAdminScreen },
    { clave: 'pagos', titulo: 'Pagos', icono: 'card', pantalla: PagosAdminScreen },
    {
      clave: 'liquidaciones',
      titulo: 'Liquidaciones',
      icono: 'cash',
      pantalla: LiquidacionesAdminScreen,
    },
    { clave: 'reportes', titulo: 'Reportes', icono: 'bar-chart', pantalla: ReportesAdminScreen },
    {
      clave: 'notificaciones',
      titulo: 'Notificaciones',
      icono: 'notifications',
      pantalla: NotificacionesAdminScreen,
    },
    {
      clave: 'moderacion',
      titulo: 'Moderar chat',
      icono: 'chatbubbles',
      pantalla: ModeracionChatAdminScreen,
    },
    {
      clave: 'configuracion',
      titulo: 'Configuración',
      icono: 'settings',
      pantalla: ConfiguracionAdminScreen,
    },
    { clave: 'soporte', titulo: 'Soporte', icono: 'help-circle', pantalla: SoporteAdminScreen },
    {
      clave: 'penalizaciones',
      titulo: 'Penalizaciones',
      icono: 'alert-circle',
      pantalla: PenalizacionesAdminScreen,
    },
  ];
  const grupos: [string, string[]][] = [
    ['Inicio', ['dashboard']],
    ['Personas', ['usuarios', 'tecnicos', 'validacion']],
    ['Operación', ['ordenes', 'mapa', 'disputas']],
    ['Finanzas', ['pagos', 'liquidaciones', 'reportes']],
    ['Administración', ['catalogo', 'soporte', 'notificaciones', 'moderacion', 'penalizaciones', 'auditoria', 'configuracion']],
  ];
  return grupos.flatMap(([grupo, claves]) => claves.map(clave => ({ ...secciones.find(s => s.clave === clave)!, grupo })));
}

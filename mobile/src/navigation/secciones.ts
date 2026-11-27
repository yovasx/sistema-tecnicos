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
import { PerfilTecnico } from '../screens/tecnico/PerfilTecnico';
import { CoberturaTecnico } from '../screens/tecnico/CoberturaTecnico';
import { CoberturasAdminScreen } from '../screens/admin/CoberturasAdminScreen';
import { DashboardAdminScreen } from '../screens/admin/DashboardAdminScreen';
import { UsuariosAdminScreen } from '../screens/admin/UsuariosAdminScreen';
import { CatalogoAdminScreen } from '../screens/admin/CatalogoAdminScreen';
import { ValidacionAdminScreen } from '../screens/admin/ValidacionAdminScreen';
import { TecnicosAdminScreen } from '../screens/admin/TecnicosAdminScreen';
import { OrdenesAdminScreen } from '../screens/admin/OrdenesAdminScreen';
import { MiPerfilAdminScreen } from '../screens/admin/MiPerfilAdminScreen';
import { DisputasAdminScreen } from '../screens/admin/DisputasAdminScreen';
import { AuditoriaAdminScreen } from '../screens/admin/AuditoriaAdminScreen';
import { ModeracionChatAdminScreen } from '../screens/admin/ModeracionChatAdminScreen';
import { NotificacionesAdminScreen } from '../screens/admin/NotificacionesAdminScreen';
import { ReportesAdminScreen } from '../screens/admin/ReportesAdminScreen';
import { CoordinacionScreen } from '../screens/admin/CoordinacionScreen';
import { EquiposCliente } from '../screens/cliente/EquiposCliente';

export interface Seccion {
  clave: string;
  titulo: string;
  icono: keyof typeof Ionicons.glyphMap;
  pantalla: ComponentType;
  grupo?: string;
  pendiente?: boolean;
}

/**
 * Una sola lista de secciones por rol y perfil: alimenta el sidebar de
 * escritorio. En el teléfono se siguen usando las tabs, con el mismo orden.
 */
export function seccionesClientePersona(): Seccion[] {
  return [
    { clave: 'inicio', titulo: 'Inicio', icono: 'home', pantalla: InicioCliente },
    { clave: 'servicios', titulo: 'Servicios', icono: 'construct', pantalla: MisServicios },
    { clave: 'equipos', titulo: 'Mis equipos', icono: 'hardware-chip', pantalla: EquiposCliente },
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
    { clave: 'equipos', titulo: 'Equipos y sucursales', icono: 'hardware-chip', pantalla: EquiposCliente },
    { clave: 'facturacion', titulo: 'Costos autorizados', icono: 'receipt', pantalla: FacturacionEmpresa },
    { clave: 'perfil', titulo: 'Perfil', icono: 'person', pantalla: PerfilEmpresa },
  ];
}

export function seccionesTecnico(): Seccion[] {
  return [
    { clave: 'panel', titulo: 'Panel', icono: 'speedometer', pantalla: PanelTecnico },
    { clave: 'servicios', titulo: 'Servicios', icono: 'construct', pantalla: ServiciosTecnico },
    { clave: 'cobertura', titulo: 'Mi cobertura', icono: 'map', pantalla: CoberturaTecnico },
    { clave: 'notificaciones', titulo: 'Notificaciones', icono: 'notifications', pantalla: NotificacionesCliente },
    { clave: 'perfil', titulo: 'Perfil', icono: 'person', pantalla: PerfilTecnico },
  ];
}

/** W42–W61: secciones del backoffice, incluido el directorio técnico W61. */
export function seccionesAdmin(): Seccion[] {
  const secciones: Seccion[] = [
    { clave: 'dashboard', titulo: 'Resumen', icono: 'grid', pantalla: DashboardAdminScreen },
    { clave: 'operacion', titulo: 'Coordinación', icono: 'clipboard', pantalla: CoordinacionScreen },
    { clave: 'perfil', titulo: 'Mi perfil', icono: 'person-circle', pantalla: MiPerfilAdminScreen },
    { clave: 'ordenes', titulo: 'Órdenes', icono: 'receipt', pantalla: OrdenesAdminScreen },
    { clave: 'usuarios', titulo: 'Usuarios', icono: 'people', pantalla: UsuariosAdminScreen },
    { clave: 'tecnicos', titulo: 'Técnicos', icono: 'construct', pantalla: TecnicosAdminScreen },
    { clave: 'coberturas', titulo: 'Revisar coberturas', icono: 'map', pantalla: CoberturasAdminScreen },
    {
      clave: 'validacion',
      titulo: 'Validar técnicos',
      icono: 'checkmark-circle',
      pantalla: ValidacionAdminScreen,
    },
    { clave: 'disputas', titulo: 'Disputas', icono: 'warning', pantalla: DisputasAdminScreen },
    { clave: 'auditoria', titulo: 'Auditoría', icono: 'document-text', pantalla: AuditoriaAdminScreen },
    { clave: 'catalogo', titulo: 'Catálogo', icono: 'list', pantalla: CatalogoAdminScreen },
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
  ];
  const grupos: [string, string[]][] = [
    ['Inicio', ['dashboard', 'operacion']],
    ['Personas', ['usuarios', 'tecnicos', 'validacion', 'coberturas']],
    ['Operación', ['ordenes', 'disputas']],
    ['Análisis', ['reportes']],
    ['Administración', ['catalogo', 'notificaciones', 'moderacion', 'auditoria']],
    ['Mi cuenta', ['perfil']],
  ];
  return grupos.flatMap(([grupo, claves]) => claves.map(clave => ({
    ...secciones.find(s => s.clave === clave)!, grupo,
  })));
}

import {
  Auditoria,
  Disputa,
  LiquidacionAdmin,
  MensajeModerado,
  NotificacionSistema,
  PaginaAdmin,
  PuntoActivo,
  ResumenOperativo,
} from '../models/Backoffice';

export interface BackofficeRepository {
  resumen(): Promise<ResumenOperativo>;
  disputas(estado: string, pagina: number): Promise<PaginaAdmin<Disputa>>;
  revisarDisputa(id: number, estado: 'en_revision' | 'resuelta', resolucion: string): Promise<void>;
  propiasDisputas(pagina: number): Promise<PaginaAdmin<Disputa>>;
  abrirDisputa(orden: number, motivo: string): Promise<void>;
  auditoria(origen: string, pagina: number): Promise<PaginaAdmin<Auditoria>>;
  moderacion(pendientes: boolean, pagina: number): Promise<PaginaAdmin<MensajeModerado>>;
  revisarMensaje(id: number, decision: 'sin_accion' | 'advertencia', nota: string): Promise<void>;
  notificaciones(tipo: string, pagina: number): Promise<PaginaAdmin<NotificacionSistema>>;
  liquidaciones(estado: string, pagina: number): Promise<PaginaAdmin<LiquidacionAdmin>>;
  mapa(): Promise<PuntoActivo[]>;
  descargarReporte(desde: string, hasta: string): Promise<void>;
}

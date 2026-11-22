import { PanelTecnicoDatos, Pagina, ServicioTecnico, DetalleTecnico, Cotizacion, ItemCotizacion,
  Liquidacion, Notificacion, Conversacion, Preferencias, SesionGps } from '../models/Operacion';

export interface OperacionRepository {
  panel(): Promise<PanelTecnicoDatos>;
  servicios(pagina: number): Promise<Pagina<ServicioTecnico>>;
  detalle(id: number): Promise<DetalleTecnico>;
  disponibilidad(disponible: boolean): Promise<void>;
  aceptar(id: number): Promise<void>;
  avanzar(id: number, accion: 'llegada' | 'reparacion' | 'finalizar'): Promise<void>;
  cancelar(id: number, motivo: string): Promise<void>;
  cotizaciones(id: number, tecnico: boolean): Promise<Cotizacion[]>;
  cotizar(id: number, clave: string, motivo: string, items: ItemCotizacion[]): Promise<void>;
  responder(id: number, cotizacion: number, acepta: boolean, motivo: string): Promise<void>;
  liquidaciones(pagina: number): Promise<Pagina<Liquidacion>>;
  notificaciones(pagina: number): Promise<Pagina<Notificacion>>;
  leer(id: number): Promise<void>;
  mensajes(id: number, antes?: number): Promise<Conversacion>;
  enviar(id: number, clave: string, contenido: string): Promise<void>;
  preferencias(): Promise<Preferencias>;
  guardarPreferencias(p: Preferencias): Promise<Preferencias>;
  iniciarGps(orden: number, plataforma: string, segundoPlano: boolean): Promise<SesionGps>;
}

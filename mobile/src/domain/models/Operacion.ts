export interface Pagina<T> { elementos: T[]; total: number; pagina: number; tamano: number }
export interface ServicioTecnico {
  id: number; categoria: string; estado: string; urgencia: boolean; creadoEn: string;
}
/** Oferta del match: la dirección y el cliente se revelan al aceptar. */
export interface OfertaTecnico {
  oferta: number; orden: number; categoria: string; urgencia: boolean;
  distanciaMetros: number | null; enviadaEn: string; expiraEn: string;
}
export interface PanelTecnicoDatos {
  disponibilidad: 'disponible' | 'ocupado' | 'fuera_servicio';
  finalizados: number; activos: number; ofertas?: OfertaTecnico[]; solicitudes: ServicioTecnico[];
}
export interface DetalleTecnico {
  id: number; categoria: string; estado: string; descripcion: string; referencia: string;
  latitud: number; longitud: number; cliente: string | null; creadoEn: string; miCalificacion: number | null;
}
export interface ItemCotizacion {
  tipo: string; descripcion: string; cantidad: number; precioUnitario: number; subtotal?: number;
}
export interface Cotizacion {
  id: number; version: number; estado: string; motivo: string | null;
  total: number; moneda: string; expiraEn: string | null; items: ItemCotizacion[];
}
export interface Liquidacion {
  id: number; orden: number; bruto: number; comision: number; neto: number; moneda: string; estado: string; creadaEn: string;
}
export interface Notificacion {
  id: number; orden: number | null; tipo: string; mensaje: string; leido: boolean; enviadoEn: string;
}
export interface Mensaje {
  id: number; propio: boolean; tipo: string; contenido: string; contieneContacto: boolean; enviadoEn: string;
}
export interface Conversacion { abierta: boolean; mensajes: Mensaje[]; hayAnteriores: boolean }
export interface Preferencias { revision: number; permitirGps: boolean }
export interface SesionGps { sesion: string; orden: number; segundoPlano: boolean; expiraEn: string }

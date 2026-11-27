import {
  CategoriaSolicitud,
  CrearSolicitud,
  DetalleServicio,
  Facturacion,
  PaginaServicios,
  ResultadoSolicitud,
} from '../models/SolicitudServicio';

export interface SolicitudesRepository {
  categorias(): Promise<CategoriaSolicitud[]>;
  crear(solicitud: CrearSolicitud): Promise<ResultadoSolicitud>;
  propias(pagina: number): Promise<PaginaServicios>;
  detalle(id: number): Promise<DetalleServicio>;
  facturacion(filtros?: { desde?: string; hasta?: string; sucursal?: number }): Promise<Facturacion>;
  descargarEvidencia(id: number, extension: string | null): Promise<void>;
}

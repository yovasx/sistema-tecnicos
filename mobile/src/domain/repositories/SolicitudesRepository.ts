import {
  CategoriaSolicitud,
  CrearSolicitud,
  DetalleServicio,
  PaginaServicios,
  ResultadoSolicitud,
} from '../models/SolicitudServicio';

export interface SolicitudesRepository {
  categorias(): Promise<CategoriaSolicitud[]>;
  crear(solicitud: CrearSolicitud): Promise<ResultadoSolicitud>;
  propias(pagina: number): Promise<PaginaServicios>;
  detalle(id: number): Promise<DetalleServicio>;
  descargarEvidencia(id: number, extension: string | null): Promise<void>;
}

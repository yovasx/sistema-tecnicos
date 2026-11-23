import { DetalleOrdenAdmin, FilaOrdenAdmin, FiltrosOrdenesAdmin, PaginaOrdenes, TransicionOrdenAdmin } from '../models/OrdenAdmin';

export interface OrdenesAdminRepository {
  listar(filtros: FiltrosOrdenesAdmin): Promise<PaginaOrdenes<FilaOrdenAdmin>>;
  detalle(id: number): Promise<DetalleOrdenAdmin>;
  historial(id: number, pagina: number): Promise<PaginaOrdenes<TransicionOrdenAdmin>>;
}

import { DetalleTecnicoAdmin, FiltrosTecnicos, PaginaTecnicos, RevisionTecnicoAdmin } from '../models/TecnicoAdmin';

export interface TecnicosAdminRepository {
  listar(filtros: FiltrosTecnicos): Promise<PaginaTecnicos>;
  detalle(id: number): Promise<DetalleTecnicoAdmin>;
  revisiones(id: number, pagina: number): Promise<RevisionTecnicoAdmin[]>;
}

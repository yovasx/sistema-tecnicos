import { CategoriaPublica } from '../../domain/models/Publico';
import { PublicoRepository } from '../../domain/repositories/PublicoRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

/** Adaptador HTTP del catálogo público. */
export class PublicoApiRepository implements PublicoRepository {
  async categorias(): Promise<CategoriaPublica[]> {
    try {
      const { data } = await apiClient.get<CategoriaPublica[]>('/api/publico/categorias');
      return data;
    } catch (error) {
      throw traducirError(error);
    }
  }
}

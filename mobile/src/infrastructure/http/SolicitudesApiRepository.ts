import { Platform } from 'react-native';
import axios from 'axios';
import {
  CategoriaSolicitud,
  CrearSolicitud,
  DetalleServicio,
  PaginaServicios,
  ResultadoSolicitud,
} from '../../domain/models/SolicitudServicio';
import { SolicitudesRepository } from '../../domain/repositories/SolicitudesRepository';
import { descargarEvidenciaOrden } from '../storage/evidenciaOrden';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class SolicitudesApiRepository implements SolicitudesRepository {
  async categorias(): Promise<CategoriaSolicitud[]> {
    try {
      return (await apiClient.get<CategoriaSolicitud[]>('/api/ordenes/categorias')).data;
    } catch (e) {
      throw traducirError(e);
    }
  }

  async crear(s: CrearSolicitud): Promise<ResultadoSolicitud> {
    const form = new FormData();
    for (const k of [
      'clave',
      'categoria',
      'descripcion',
      'latitud',
      'longitud',
      'referencia',
      'urgencia',
    ] as const) {
      form.append(k, String(s[k]));
    }
    if (s.evidencia) {
      const e = s.evidencia;
      if (Platform.OS === 'web' && e.contenidoWeb) {
        form.append('evidencia', e.contenidoWeb, e.nombre);
      } else {
        form.append('evidencia', { uri: e.uri, name: e.nombre, type: e.tipo } as unknown as Blob);
      }
    }
    try {
      return (
        await apiClient.post<ResultadoSolicitud>('/api/ordenes', form, {
          timeout: 30000,
          ...(Platform.OS === 'web'
            ? {}
            : { headers: { 'Content-Type': 'multipart/form-data' } }),
        })
      ).data;
    } catch (e) {
      throw traducirError(e);
    }
  }

  async propias(pagina: number): Promise<PaginaServicios> {
    try {
      return (
        await apiClient.get<PaginaServicios>('/api/ordenes', {
          params: { pagina, tamano: 20 },
        })
      ).data;
    } catch (e) {
      throw traducirError(e);
    }
  }

  async detalle(id: number): Promise<DetalleServicio> {
    try {
      return (await apiClient.get<DetalleServicio>(`/api/ordenes/${id}`)).data;
    } catch (e) {
      throw traducirError(e);
    }
  }

  async descargarEvidencia(id: number, extension: string | null): Promise<void> {
    try {
      await descargarEvidenciaOrden(id, extension);
    } catch (e) {
      // Los errores del dispositivo (sin app para compartir) se muestran tal cual.
      if (e instanceof Error && !axios.isAxiosError(e)) throw e;
      throw traducirError(e);
    }
  }
}

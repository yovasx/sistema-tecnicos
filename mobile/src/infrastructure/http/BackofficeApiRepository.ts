import { Platform } from 'react-native';
import {
  Auditoria,
  Disputa,
  LiquidacionAdmin,
  MensajeModerado,
  NotificacionSistema,
  PaginaAdmin,
  PuntoActivo,
  ResumenOperativo,
} from '../../domain/models/Backoffice';
import { BackofficeRepository } from '../../domain/repositories/BackofficeRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

/** Adaptador HTTP del backoffice. El reporte CSV se descarga solo en web. */
export class BackofficeApiRepository implements BackofficeRepository {
  private async get<T>(url: string): Promise<T> {
    try {
      return (await apiClient.get<T>(url)).data;
    } catch (e) {
      throw traducirError(e);
    }
  }

  private async post(url: string, datos: unknown): Promise<void> {
    try {
      await apiClient.post(url, datos);
    } catch (e) {
      throw traducirError(e);
    }
  }

  resumen() {
    return this.get<ResumenOperativo>('/api/admin/resumen-operativo');
  }

  disputas(estado: string, pagina: number) {
    const filtro = estado ? `&estado=${encodeURIComponent(estado)}` : '';
    return this.get<PaginaAdmin<Disputa>>(`/api/admin/disputas?pagina=${pagina}${filtro}`);
  }

  revisarDisputa(id: number, estado: 'en_revision' | 'resuelta', resolucion: string) {
    return this.post(`/api/admin/disputas/${id}/revisar`, { estado, resolucion });
  }

  propiasDisputas(pagina: number, orden?: number) {
    return this.get<PaginaAdmin<Disputa>>(`/api/disputas?pagina=${pagina}${orden ? `&orden=${orden}` : ''}`);
  }

  abrirDisputa(orden: number, motivo: string) {
    return this.post('/api/disputas', { orden, motivo });
  }

  auditoria(origen: string, pagina: number) {
    const filtro = origen ? `&origen=${encodeURIComponent(origen)}` : '';
    return this.get<PaginaAdmin<Auditoria>>(`/api/admin/auditoria?pagina=${pagina}${filtro}`);
  }

  moderacion(pendientes: boolean, pagina: number) {
    return this.get<PaginaAdmin<MensajeModerado>>(
      `/api/admin/moderacion?pagina=${pagina}&pendientes=${pendientes}`,
    );
  }

  revisarMensaje(id: number, decision: 'sin_accion' | 'advertencia', nota: string) {
    return this.post(`/api/admin/moderacion/${id}/revisar`, { decision, nota });
  }

  notificaciones(tipo: string, pagina: number) {
    const filtro = tipo ? `&tipo=${encodeURIComponent(tipo)}` : '';
    return this.get<PaginaAdmin<NotificacionSistema>>(`/api/admin/notificaciones?pagina=${pagina}${filtro}`);
  }

  liquidaciones(estado: string, pagina: number) {
    const filtro = estado ? `&estado=${encodeURIComponent(estado)}` : '';
    return this.get<PaginaAdmin<LiquidacionAdmin>>(`/api/admin/liquidaciones?pagina=${pagina}${filtro}`);
  }

  mapa() {
    return this.get<PuntoActivo[]>('/api/admin/mapa');
  }

  async descargarReporte(desde: string, hasta: string): Promise<void> {
    if (Platform.OS !== 'web') {
      throw new Error('La descarga de reportes está disponible en el backoffice web.');
    }
    let blob: Blob;
    try {
      const respuesta = await apiClient.get<Blob>('/api/admin/reportes/ordenes.csv', {
        params: { desde, hasta },
        responseType: 'blob',
      });
      blob = respuesta.data;
    } catch (e) {
      throw traducirError(e);
    }
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `ordenes-${desde}-${hasta}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }
}

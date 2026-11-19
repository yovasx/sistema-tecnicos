import { Platform } from 'react-native';
import { ArchivoExpediente, DocumentosExpediente, Especialidad, Expediente, ExpedienteAdmin } from '../../domain/models/Expediente';
import { TecnicoRepository } from '../../domain/repositories/TecnicoRepository';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class TecnicoApiRepository implements TecnicoRepository {
  private async pedir<T>(metodo: 'get' | 'post' | 'put', url: string, data?: unknown): Promise<T> {
    try { return (await apiClient.request<T>({ method: metodo, url, data })).data; }
    catch (e) { throw traducirError(e); }
  }
  expediente() { return this.pedir<Expediente>('get', '/api/tecnicos/expediente'); }
  solicitarCodigo() { return this.pedir<{ mensaje: string }>('post', '/api/tecnicos/verificacion/email/solicitar'); }
  confirmarCodigo(codigo: string) { return this.pedir<void>('post', '/api/tecnicos/verificacion/email/confirmar', { codigo }); }
  guardarDatos(ci: string, fechaNacimiento: string) {
    return this.pedir<void>('put', '/api/tecnicos/expediente/datos-personales', { ci, fechaNacimiento });
  }
  async documentos(archivos: DocumentosExpediente) {
    const form = new FormData();
    function adjuntar(campo: string, archivo: ArchivoExpediente) {
      if (Platform.OS === 'web' && archivo.contenidoWeb) form.append(campo, archivo.contenidoWeb, archivo.nombre);
      else form.append(campo, { uri: archivo.uri, name: archivo.nombre, type: archivo.tipo } as unknown as Blob);
    }
    if (archivos.frente) adjuntar('ci_frente', archivos.frente);
    if (archivos.dorso) adjuntar('ci_dorso', archivos.dorso);
    archivos.certificados?.forEach((a) => adjuntar('certificaciones', a));
    try {
      // Axios asigna boundary en web; RN necesita multipart en el adaptador nativo.
      await apiClient.post('/api/tecnicos/expediente/documentos', form,
        Platform.OS === 'web' ? {} : { headers: { 'Content-Type': 'multipart/form-data' } });
    } catch (e) { throw traducirError(e); }
  }
  categorias() { return this.pedir<Especialidad[]>('get', '/api/tecnicos/expediente/categorias'); }
  especialidades(categorias: number[]) { return this.pedir<void>('put', '/api/tecnicos/expediente/especialidades', { categorias }); }
  zona(nombre: string, lat: number, lng: number, radio: number) {
    return this.pedir<void>('put', '/api/tecnicos/expediente/zonas', { nombre, lat, lng, radio });
  }
  enviar() { return this.pedir<void>('post', '/api/tecnicos/expediente/enviar'); }
  cola(estado: string) { return this.pedir<ExpedienteAdmin[]>('get', `/api/admin/tecnicos/expedientes?estado=${encodeURIComponent(estado)}`); }
  detalleAdmin(id: number) { return this.pedir<Expediente>('get', `/api/admin/tecnicos/expedientes/${id}`); }
  observar(id: number, observaciones: Record<string, string>) {
    return this.pedir<void>('post', `/api/admin/tecnicos/expedientes/${id}/observar`, { observaciones });
  }
  aprobar(id: number) { return this.pedir<void>('post', `/api/admin/tecnicos/expedientes/${id}/aprobar`); }
  rechazar(id: number, motivo: string) { return this.pedir<void>('post', `/api/admin/tecnicos/expedientes/${id}/rechazar`, { motivo }); }
  async descargar(url: string): Promise<Blob> {
    try {
      const nombre = url.slice(url.lastIndexOf('/') + 1);
      return (await apiClient.get<Blob>(`/api/tecnicos/expediente/documentos/${nombre}`, { responseType: 'blob' })).data;
    } catch (e) { throw traducirError(e); }
  }
}

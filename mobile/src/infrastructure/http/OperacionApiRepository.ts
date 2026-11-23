import { OperacionRepository } from '../../domain/repositories/OperacionRepository';
import { PanelTecnicoDatos, Pagina, ServicioTecnico, DetalleTecnico, Cotizacion, ItemCotizacion,
  Liquidacion, Notificacion, Conversacion, Preferencias, SesionGps } from '../../domain/models/Operacion';
import { apiClient } from './apiClient';
import { traducirError } from './errores';

export class OperacionApiRepository implements OperacionRepository {
  private async get<T>(url: string): Promise<T> {
    try { return (await apiClient.get<T>(url)).data; } catch (e) { throw traducirError(e); }
  }
  private async post(url: string, datos?: unknown) {
    try { await apiClient.post(url, datos); } catch (e) { throw traducirError(e); }
  }
  panel() { return this.get<PanelTecnicoDatos>('/api/tecnicos/panel'); }
  servicios(p: number) { return this.get<Pagina<ServicioTecnico>>(`/api/tecnicos/servicios?pagina=${p}`); }
  detalle(id: number) { return this.get<DetalleTecnico>(`/api/tecnicos/servicios/${id}`); }
  async disponibilidad(disponible: boolean) {
    try { await apiClient.put('/api/tecnicos/disponibilidad', { disponible }); } catch (e) { throw traducirError(e); }
  }
  aceptar(id: number) { return this.post(`/api/tecnicos/servicios/${id}/aceptar`); }
  aceptarOferta(oferta: number) { return this.post(`/api/tecnicos/ofertas/${oferta}/aceptar`); }
  rechazarOferta(oferta: number) { return this.post(`/api/tecnicos/ofertas/${oferta}/rechazar`); }
  avanzar(id: number, accion: 'llegada' | 'reparacion' | 'finalizar') { return this.post(`/api/tecnicos/servicios/${id}/${accion}`); }
  cancelar(id: number, motivo: string) { return this.post(`/api/ordenes/${id}/cancelar`, { motivo }); }
  cotizaciones(id: number, tecnico: boolean) {
    return this.get<Cotizacion[]>(`${tecnico ? '/api/tecnicos/servicios' : '/api/ordenes'}/${id}/cotizaciones`);
  }
  cotizar(id: number, clave: string, motivo: string, items: ItemCotizacion[]) {
    return this.post(`/api/tecnicos/servicios/${id}/cotizaciones`, { clave, motivo, items });
  }
  responder(id: number, cotizacion: number, acepta: boolean, motivo: string) {
    return this.post(`/api/ordenes/${id}/cotizaciones/${cotizacion}/responder`, { acepta, motivo });
  }
  liquidaciones(p: number) { return this.get<Pagina<Liquidacion>>(`/api/tecnicos/liquidaciones?pagina=${p}`); }
  notificaciones(p: number) { return this.get<Pagina<Notificacion>>(`/api/notificaciones?pagina=${p}`); }
  async leer(id: number) {
    try { await apiClient.patch(`/api/notificaciones/${id}/leer`); } catch (e) { throw traducirError(e); }
  }
  mensajes(id: number, antes = 0) { return this.get<Conversacion>(`/api/servicios/${id}/mensajes?antes=${antes}`); }
  enviar(id: number, clave: string, contenido: string) { return this.post(`/api/servicios/${id}/mensajes`, { clave, contenido }); }
  preferencias() { return this.get<Preferencias>('/api/perfil/preferencias'); }
  async guardarPreferencias(p: Preferencias) {
    try { return (await apiClient.put<Preferencias>('/api/perfil/preferencias', p)).data; }
    catch (e) { throw traducirError(e); }
  }
  async iniciarGps(orden: number, plataforma: string, segundoPlano: boolean) {
    try { return (await apiClient.post<SesionGps>(`/api/tecnicos/servicios/${orden}/gps`, { plataforma, segundoPlano })).data; }
    catch (e) { throw traducirError(e); }
  }
}

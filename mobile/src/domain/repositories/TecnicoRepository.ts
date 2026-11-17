import { DocumentosExpediente, Especialidad, Expediente, ExpedienteAdmin } from '../models/Expediente';

/** Puertos del expediente privado y de la revisión documental. */
export interface TecnicoRepository {
  expediente(): Promise<Expediente>;
  solicitarCodigo(): Promise<{ mensaje: string }>;
  confirmarCodigo(codigo: string): Promise<void>;
  guardarDatos(ci: string, fechaNacimiento: string): Promise<void>;
  documentos(archivos: DocumentosExpediente): Promise<void>;
  categorias(): Promise<Especialidad[]>;
  especialidades(categorias: number[]): Promise<void>;
  zona(nombre: string, lat: number, lng: number, radio: number): Promise<void>;
  enviar(): Promise<void>;
  cola(estado: string): Promise<ExpedienteAdmin[]>;
  detalleAdmin(id: number): Promise<Expediente>;
  observar(id: number, observaciones: Record<string, string>): Promise<void>;
  aprobar(id: number): Promise<void>;
  rechazar(id: number, motivo: string): Promise<void>;
  descargar(url: string): Promise<Blob>;
}

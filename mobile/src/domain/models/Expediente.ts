export type EstadoExpediente = 'borrador' | 'en_revision' | 'observado' | 'aprobado' | 'rechazado';
export interface Especialidad { id: number; nombre: string }
export interface ZonaCobertura {
  id: number; nombre: string; lat: number; lng: number; radio: number;
}
export interface Expediente {
  nivel: number;
  disponibilidad: 'fuera_servicio' | 'disponible' | 'ocupado';
  estadoExpediente: EstadoExpediente;
  email: string;
  emailVerificadoEn: string | null;
  ci: string | null;
  fechaNacimiento: string | null;
  ciFrenteUrl: string | null;
  ciDorsoUrl: string | null;
  certificacionesUrl: string[];
  especialidades: Especialidad[];
  zonas: ZonaCobertura[];
  observaciones: Record<string, string>;
  enviadoEn: string | null;
}
export interface ArchivoExpediente {
  nombre: string; uri: string; tipo: string; tamano?: number; contenidoWeb?: Blob;
}
export interface DocumentosExpediente {
  frente?: ArchivoExpediente; dorso?: ArchivoExpediente; certificados?: ArchivoExpediente[];
}
export interface ExpedienteAdmin {
  tecnicoId: number; nombre: string; email: string; estadoExpediente: EstadoExpediente;
  ci: string; ciFrenteUrl: string; ciDorsoUrl: string; certificacionesUrl: string[];
  observaciones: Record<string, string>; enviadoEn: string;
}
export type DatosRegistroTecnico = {
  nombre: string; apellido: string; email: string; telefono?: string; password: string;
};

import { Platform } from 'react-native';
import { HogarApiRepository } from './http/HogarApiRepository';
import { OperacionApiRepository } from './http/OperacionApiRepository';
import { CoberturaApiRepository } from './http/CoberturaApiRepository';
import { AdminApiRepository } from './http/AdminApiRepository';
import { AuthApiRepository } from './http/AuthApiRepository';
import { PublicoApiRepository } from './http/PublicoApiRepository';
import { TecnicoApiRepository } from './http/TecnicoApiRepository';
import { RecuperacionApiRepository } from './http/RecuperacionApiRepository';
import { InvitacionApiRepository } from './http/InvitacionApiRepository';
import { TecnicosAdminApiRepository } from './http/TecnicosAdminApiRepository';
import { OrdenesAdminApiRepository } from './http/OrdenesAdminApiRepository';
import { BackofficeApiRepository } from './http/BackofficeApiRepository';
import { GestionLocalApiRepository } from './http/GestionLocalApiRepository';
import { SolicitudesApiRepository } from './http/SolicitudesApiRepository';
import { PerfilApiRepository } from './http/PerfilApiRepository';
import { SecureTokenStorage } from './storage/SecureTokenStorage';
import { WebTokenStorage } from './storage/WebTokenStorage';

/**
 * Composition root manual: elige el storage según la plataforma y arma los
 * repositorios. No hay framework de DI.
 */
export const tokenStorage =
  Platform.OS === 'web' ? new WebTokenStorage() : new SecureTokenStorage();

export const authRepository = new AuthApiRepository();
export const perfilRepository = new PerfilApiRepository();
export const hogarRepository = new HogarApiRepository();
export const operacionRepository = new OperacionApiRepository();
export const coberturaRepository = new CoberturaApiRepository();
export const adminRepository = new AdminApiRepository();
export const publicoRepository = new PublicoApiRepository();
export const tecnicoRepository = new TecnicoApiRepository();
export const recuperacionRepository = new RecuperacionApiRepository();
export const invitacionRepository = new InvitacionApiRepository();
export const tecnicosAdminRepository = new TecnicosAdminApiRepository();
export const ordenesAdminRepository = new OrdenesAdminApiRepository();
export const solicitudesRepository = new SolicitudesApiRepository();
export const backofficeRepository = new BackofficeApiRepository();
export const gestionLocalRepository = new GestionLocalApiRepository();

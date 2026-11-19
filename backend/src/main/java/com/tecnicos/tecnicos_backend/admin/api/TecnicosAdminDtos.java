package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.identity.api.ExpedienteResponse;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class TecnicosAdminDtos {
    private TecnicosAdminDtos() {}
    /** El listado no transporta CI, fecha de nacimiento ni URLs de documentos. */
    public record Fila(long id, String nombre, String email, boolean activo,
                       String estadoValidacion, String estadoExpediente, String disponibilidad,
                       List<String> especialidades, boolean expedienteRequerido, OffsetDateTime enviadoEn) {}
    public record Pagina(List<Fila> elementos, long total, int pagina, int tamano) {}
    public record Detalle(UsuariosAdminDtos.Detalle cuenta, ExpedienteResponse expediente,
                          boolean expedienteRequerido, OffsetDateTime aprobadoEn, String aprobadoPor) {}
    public record Revision(long id, String revisor, String decision, Map<String,String> observaciones,
                           OffsetDateTime creadoEn) {}
}

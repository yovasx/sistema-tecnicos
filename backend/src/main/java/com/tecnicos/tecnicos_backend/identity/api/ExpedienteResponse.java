package com.tecnicos.tecnicos_backend.identity.api;

import java.util.List;
import java.util.Map;

/**
 * Snapshot del expediente técnico para la UI del wizard y la cola de admin.
 *
 * <p>Las fechas viajan como texto de Postgres; {@code observaciones} es el JSONB tal cual
 * (clave = campo observado, valor = motivo).</p>
 */
public record ExpedienteResponse(
        int nivel,
        String disponibilidad,
        String estadoExpediente,
        String email,
        String emailVerificadoEn,
        String ci,
        String fechaNacimiento,
        String ciFrenteUrl,
        String ciDorsoUrl,
        List<String> certificacionesUrl,
        List<EspecialidadResumen> especialidades,
        List<ZonaResumen> zonas,
        Map<String, String> observaciones,
        String enviadoEn) {

    public record EspecialidadResumen(int id, String nombre) {
    }

    public record ZonaResumen(long id, String nombre, double lat, double lng, long radio) {
    }
}

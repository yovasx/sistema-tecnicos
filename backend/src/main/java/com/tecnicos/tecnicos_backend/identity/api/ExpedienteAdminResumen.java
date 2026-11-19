package com.tecnicos.tecnicos_backend.identity.api;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Fila de la cola de admin: expediente en revisión u observado, con los
 * documentos para descargar y las observaciones previas si las hay.
 */
public record ExpedienteAdminResumen(
        Long tecnicoId,
        String nombre,
        String email,
        String estadoExpediente,
        String ci,
        String ciFrenteUrl,
        String ciDorsoUrl,
        List<String> certificacionesUrl,
        Map<String, String> observaciones,
        OffsetDateTime enviadoEn) {
}

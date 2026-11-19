package com.tecnicos.tecnicos_backend.admin.api;

/**
 * Fila de {@code GET /api/admin/tecnicos/pendientes}: perfiles de técnico que
 * aún no fueron aprobados ni rechazados.
 */
public record TecnicoPendiente(
        Long usuarioId,
        String nombre,
        String email,
        String estadoValidacion,
        String disponibilidad,
        String certificacionesUrl) {
}

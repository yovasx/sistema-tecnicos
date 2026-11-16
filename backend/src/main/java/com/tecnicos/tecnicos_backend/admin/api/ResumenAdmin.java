package com.tecnicos.tecnicos_backend.admin.api;

/** Resumen numérico del tablero admin (datos reales, sin inventar). */
public record ResumenAdmin(
        long totalUsuarios,
        long clientes,
        long tecnicos,
        long administradores,
        long tecnicosPendientes,
        long tecnicosAprobados,
        long categoriasActivas) {
}

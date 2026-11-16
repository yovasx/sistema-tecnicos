package com.tecnicos.tecnicos_backend.admin.api;

import java.math.BigDecimal;

/**
 * Fila de {@code GET /api/admin/categorias}: categoría + tarifa + comisión,
 * leídas de orders y billing en una sola consulta.
 */
public record CategoriaAdmin(
        Integer id,
        String nombre,
        String descripcion,
        Boolean activa,
        BigDecimal tarifaVisita,
        BigDecimal tarifaHora,
        BigDecimal recargoUrgenciaPct,
        String moneda,
        BigDecimal comisionPct) {
}

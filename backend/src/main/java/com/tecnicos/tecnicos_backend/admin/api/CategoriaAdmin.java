package com.tecnicos.tecnicos_backend.admin.api;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Fila de {@code GET /api/admin/categorias}: categoría + tarifa + comisión
 * vigentes, leídas de orders y billing en una sola consulta.
 *
 * <p>Las tarifas y comisiones se versionan por fecha: aquí solo viaja la
 * versión abierta. Las versiones anteriores quedan en la base y nunca se
 * reescriben.</p>
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
        LocalDate tarifaVigenteDesde,
        BigDecimal comisionPct,
        LocalDate comisionVigenteDesde) {
}

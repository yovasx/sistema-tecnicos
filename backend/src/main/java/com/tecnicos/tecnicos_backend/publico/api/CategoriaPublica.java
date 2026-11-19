package com.tecnicos.tecnicos_backend.publico.api;

import java.math.BigDecimal;

/**
 * Categoría tal como se muestra en la landing pública.
 *
 * <p>No incluye comisión, ids internos ni datos de otros usuarios: es
 * información de catálogo apta para cualquiera.</p>
 */
public record CategoriaPublica(
        String nombre,
        String descripcion,
        BigDecimal tarifaVisita,
        BigDecimal tarifaHora,
        String moneda) {
}

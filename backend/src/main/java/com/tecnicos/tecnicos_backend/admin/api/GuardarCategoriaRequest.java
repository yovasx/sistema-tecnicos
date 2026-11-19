package com.tecnicos.tecnicos_backend.admin.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Cuerpo de {@code POST /api/admin/categorias} y
 * {@code PUT /api/admin/categorias/{id}}.
 *
 * <p>La validación de forma vive acá; la de negocio (unicidad, vigencias,
 * límites reales de la base) vive en {@code admin_svc.guardar_categoria}.</p>
 */
public record GuardarCategoriaRequest(
        @NotBlank(message = "El nombre es obligatorio.")
        @Size(min = 2, max = 80, message = "El nombre debe tener entre 2 y 80 caracteres.")
        String nombre,

        @Size(max = 500, message = "La descripción no puede superar los 500 caracteres.")
        String descripcion,

        @NotNull(message = "Indicá si la categoría está activa.")
        Boolean activa,

        @NotNull(message = "La tarifa de visita es obligatoria.")
        @DecimalMin(value = "0.00", message = "La tarifa de visita no puede ser negativa.")
        @Digits(integer = 8, fraction = 2, message = "La tarifa de visita admite hasta dos decimales.")
        BigDecimal tarifaVisita,

        @DecimalMin(value = "0.00", message = "La tarifa por hora no puede ser negativa.")
        @Digits(integer = 8, fraction = 2, message = "La tarifa por hora admite hasta dos decimales.")
        BigDecimal tarifaHora,

        @NotNull(message = "El recargo de urgencia es obligatorio.")
        @DecimalMin(value = "0.00", message = "El recargo de urgencia no puede ser negativo.")
        @DecimalMax(value = "100.00", message = "El recargo de urgencia no puede superar 100%.")
        @Digits(integer = 3, fraction = 2, message = "El recargo admite hasta dos decimales.")
        BigDecimal recargoUrgenciaPct,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "La moneda debe tener tres letras, por ejemplo BOB.")
        String moneda,

        @NotNull(message = "La comisión de la plataforma es obligatoria.")
        @DecimalMin(value = "0.00", message = "La comisión no puede ser negativa.")
        @DecimalMax(value = "100.00", message = "La comisión no puede superar 100%.")
        @Digits(integer = 3, fraction = 2, message = "La comisión admite hasta dos decimales.")
        BigDecimal comisionPct) {
}

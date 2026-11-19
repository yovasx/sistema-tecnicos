package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Paso zona de cobertura: barrio y círculo (centro + radio en metros). */
public record ZonaRequest(
        @NotBlank(message = "El nombre de la zona es obligatorio.")
        @jakarta.validation.constraints.Size(max = 100, message = "La zona no puede superar 100 caracteres.")
        String nombre,

        @NotNull(message = "La latitud es obligatoria.")
        Double lat,

        @NotNull(message = "La longitud es obligatoria.")
        Double lng,

        @NotNull(message = "El radio es obligatorio.")
        @DecimalMin(value = "100", message = "El radio mínimo es 100 metros.")
        @DecimalMax(value = "20000", message = "El radio máximo es 20000 metros.")
        BigDecimal radio) {
}

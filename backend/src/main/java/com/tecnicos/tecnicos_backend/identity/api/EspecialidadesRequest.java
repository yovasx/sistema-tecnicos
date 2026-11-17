package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** Paso especialidades: ids de categorías activas del catálogo. */
public record EspecialidadesRequest(
        @NotEmpty(message = "Elegí al menos una especialidad.")
        @jakarta.validation.constraints.Size(max = 20, message = "Elegí hasta 20 especialidades.")
        List<@jakarta.validation.constraints.NotNull(message = "La especialidad no puede estar vacía.") Integer> categorias) {
}

package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** Paso especialidades: ids de categorías activas del catálogo. */
public record EspecialidadesRequest(
        @NotEmpty(message = "Elegí al menos una especialidad.")
        List<Integer> categorias) {
}

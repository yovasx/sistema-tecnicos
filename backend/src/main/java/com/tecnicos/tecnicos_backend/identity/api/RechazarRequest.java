package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Motivo del rechazo; va a observaciones.motivo para que el técnico lo lea. */
public record RechazarRequest(
        @NotBlank(message = "El motivo es obligatorio.")
        @Size(max = 500, message = "El motivo no puede superar 500 caracteres.")
        String motivo) {
}

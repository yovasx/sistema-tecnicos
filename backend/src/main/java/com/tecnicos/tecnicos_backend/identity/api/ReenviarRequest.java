package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** Campos que el técnico reenvía tras observaciones; deben existir en el JSONB. */
public record ReenviarRequest(
        @NotEmpty(message = "Elegí al menos un campo para reenviar.")
        List<String> campos) {
}

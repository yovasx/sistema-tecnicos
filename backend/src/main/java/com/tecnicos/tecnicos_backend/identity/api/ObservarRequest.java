package com.tecnicos.tecnicos_backend.identity.api;

import java.util.Map;

/** Cuerpo de "observar": clave = campo del expediente, valor = motivo. */
public record ObservarRequest(
        @jakarta.validation.constraints.NotEmpty(message = "Indicá al menos un campo observado.")
        Map<String, String> observaciones) {
}

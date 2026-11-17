package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.NotBlank;

/** Código OTP de 6 dígitos que llegó por email. */
public record CodigoRequest(
        @NotBlank(message = "El código es obligatorio.")
        String codigo) {
}

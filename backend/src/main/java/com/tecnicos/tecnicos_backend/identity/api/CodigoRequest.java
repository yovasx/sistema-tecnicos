package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Código OTP de 6 dígitos que llegó por email. */
public record CodigoRequest(
        @NotBlank(message = "El código es obligatorio.")
        @Pattern(regexp = "[0-9]{6}", message = "El código debe tener 6 dígitos.")
        String codigo) {
}

package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Credenciales de ingreso.
 *
 * <p>Los mensajes están en español porque el handler de validación los devuelve
 * tal cual en {@code campos[]}.</p>
 */
public record LoginRequest(
        @NotBlank(message = "El email es obligatorio.")
        @Email(message = "Ingresa un correo electrónico válido.")
        String email,

        @NotBlank(message = "La contraseña es obligatoria.")
        String password) {
}

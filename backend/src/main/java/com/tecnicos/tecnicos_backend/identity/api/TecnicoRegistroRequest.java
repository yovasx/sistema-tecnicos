package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Alta pública de un técnico (nivel 0 del expediente).
 *
 * <p>El rol nunca se recibe: la función de la base fija {@code tecnico}. La
 * cuenta queda con expediente en borrador hasta que verifique email y complete
 * los pasos del onboarding.</p>
 */
public record TecnicoRegistroRequest(
        @NotBlank(message = "El nombre es obligatorio.")
        @Size(max = 100, message = "El nombre no puede superar 100 caracteres.")
        String nombre,

        @NotBlank(message = "El apellido es obligatorio.")
        @Size(max = 100, message = "El apellido no puede superar 100 caracteres.")
        String apellido,

        @NotBlank(message = "El email es obligatorio.")
        @Email(message = "Ingresá un email válido.")
        @Size(max = 150, message = "El email no puede superar 150 caracteres.")
        String email,

        @Size(max = 20, message = "El teléfono no puede superar 20 caracteres.")
        String telefono,

        @NotBlank(message = "La contraseña es obligatoria.")
        @Size(min = 8, max = 72, message = "La contraseña debe tener entre 8 y 72 caracteres.")
        String password) {
}

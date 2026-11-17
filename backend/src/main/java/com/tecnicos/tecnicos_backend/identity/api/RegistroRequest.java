package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Locale;

/**
 * Alta pública de un cliente.
 *
 * <p>No existe un campo {@code rol}: el backend fija {@code cliente}. El perfil
 * ({@code persona} o {@code empresa}) es lo único que elige el usuario. Los
 * datos de empresa son opcionales en el DTO y obligatorios cuando el perfil es
 * {@code empresa}; esa regla la valida el servicio y la función de la base.</p>
 */
public record RegistroRequest(
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
        String password,

        @NotNull(message = "Elegí el tipo de cuenta.")
        TipoCliente tipoCliente,

        @Size(max = 150, message = "La razón social no puede superar 150 caracteres.")
        String razonSocial,

        @Size(max = 20, message = "El NIT no puede superar 20 caracteres.")
        String nit) {

    /**
     * Normaliza los textos antes de que corra la validación: si alguien pega
     * "  Ana@Correo.BO " desde el teléfono, no queremos rechazarlo por los
     * espacios ni guardar el email con mayúsculas. El rol nunca llega acá.
     */
    public RegistroRequest {
        nombre = limpiar(nombre);
        apellido = limpiar(apellido);
        email = limpiar(email);
        if (email != null) {
            email = email.toLowerCase(Locale.ROOT);
        }
        telefono = limpiar(telefono);
        razonSocial = limpiar(razonSocial);
        nit = limpiar(nit);
        // La contraseña no se recorta: los espacios pueden ser parte de ella.
    }

    private static String limpiar(String valor) {
        if (valor == null) {
            return null;
        }
        String recortado = valor.trim();
        return recortado.isEmpty() ? null : recortado;
    }
}

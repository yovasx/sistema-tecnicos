package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.*;
import java.util.List;

public final class PerfilDtos {
    private PerfilDtos() {}
    public record Detalle(long id, long revision, String nombre, String apellido, String email,
        String telefono, String rol, String tipoCliente, String razonSocial, String nit,
        String acceso, String estadoValidacion, List<String> especialidades) {}
    public record Editar(
        @NotNull(message="Actualizá el perfil antes de guardar.")
        @PositiveOrZero(message="La revisión del perfil no es válida.") Long revision,
        @NotBlank(message="Ingresá tu nombre.")
        @Size(min=2,max=100,message="El nombre debe tener entre 2 y 100 caracteres.") String nombre,
        @NotBlank(message="Ingresá tu apellido.")
        @Size(min=2,max=100,message="El apellido debe tener entre 2 y 100 caracteres.") String apellido,
        @Size(max=20,message="El teléfono no puede superar 20 caracteres.") String telefono,
        @Size(max=150,message="La razón social no puede superar 150 caracteres.") String razonSocial,
        @Size(max=20,message="El NIT no puede superar 20 caracteres.") String nit) {}
    public record Password(
        @NotBlank(message="Ingresá tu contraseña actual.")
        @Size(max=72,message="La contraseña actual no puede superar 72 caracteres.") String actual,
        @NotBlank(message="Ingresá la nueva contraseña.")
        @Size(min=8,max=72,message="La nueva contraseña debe tener entre 8 y 72 caracteres.") String nueva) {
        @Override public String toString() { return "Password[protegida]"; }
    }
}

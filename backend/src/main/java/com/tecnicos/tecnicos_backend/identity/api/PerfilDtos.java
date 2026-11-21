package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.*;
import java.util.List;

public final class PerfilDtos {
    private PerfilDtos() {}
    public record Detalle(long id, long revision, String nombre, String apellido, String email,
        String telefono, String rol, String tipoCliente, String razonSocial, String nit,
        String acceso, String estadoValidacion, List<String> especialidades) {}
    public record Editar(
        @NotNull @PositiveOrZero Long revision,
        @NotBlank @Size(min=2,max=100) String nombre,
        @NotBlank @Size(min=2,max=100) String apellido,
        @Size(max=20) String telefono,
        @Size(max=150) String razonSocial,
        @Size(max=20) String nit) {}
    public record Password(
        @NotBlank @Size(max=72) String actual,
        @NotBlank @Size(min=8,max=72) String nueva) {
        @Override public String toString() { return "Password[protegida]"; }
    }
}

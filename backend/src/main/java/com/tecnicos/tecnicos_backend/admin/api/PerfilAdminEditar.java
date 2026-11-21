package com.tecnicos.tecnicos_backend.admin.api;

import jakarta.validation.constraints.*;

public record PerfilAdminEditar(
        @NotNull @PositiveOrZero Long revision,
        @NotBlank @Size(min=2, max=100) String nombre,
        @NotBlank @Size(min=2, max=100) String apellido,
        @Size(max=20) String telefono,
        @NotBlank @Size(min=5, max=500) String motivo) {}

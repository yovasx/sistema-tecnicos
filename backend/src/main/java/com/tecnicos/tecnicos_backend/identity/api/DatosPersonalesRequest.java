package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;

import java.time.LocalDate;

/** Paso datos personales del expediente técnico. */
public record DatosPersonalesRequest(
        @NotNull(message = "El CI es obligatorio.")
        String ci,

        @NotNull(message = "La fecha de nacimiento es obligatoria.")
        @Past(message = "La fecha de nacimiento debe ser anterior a hoy.")
        LocalDate fechaNacimiento) {
}

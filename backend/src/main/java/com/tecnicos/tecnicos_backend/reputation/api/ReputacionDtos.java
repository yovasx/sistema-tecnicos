package com.tecnicos.tecnicos_backend.reputation.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

/** Contratos de reputación. El destinatario nunca viaja en el cuerpo. */
public final class ReputacionDtos {
    private ReputacionDtos() {}

    public record Recibida(long id, short puntaje, String comentario, String categoria,
                           String autor, OffsetDateTime registradoEn) {}

    public record Resumen(double promedio, long total, long ordenesFinalizadas,
                          long ordenesCanceladas, List<Recibida> recibidas) {}

    public record Calificar(
        @NotNull(message="Selecciona una puntuación.")
        @Min(value=1,message="La puntuación debe estar entre 1 y 5.")
        @Max(value=5,message="La puntuación debe estar entre 1 y 5.") Integer puntaje,
        @Size(max=1000,message="El comentario no puede superar los 1000 caracteres.") String comentario) {}

    public record Creada(long id, short puntaje) {}
}

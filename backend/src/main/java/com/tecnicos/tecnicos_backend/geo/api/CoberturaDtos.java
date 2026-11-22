package com.tecnicos.tecnicos_backend.geo.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

public final class CoberturaDtos {
    private CoberturaDtos() {}
    public record Zona(@NotBlank @Size(min=2,max=100) String nombre,
        @NotNull @DecimalMin("-85") @DecimalMax("85") Double latitud,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitud,
        @NotNull @Min(100) @Max(50000) Integer radioMetros) {}
    public record Propuesta(@NotNull UUID clave,@NotNull @PositiveOrZero Long revision,
        @NotBlank @Size(min=5,max=500) String motivo,@NotNull @Size(min=1,max=5) List<@NotNull @Valid Zona> zonas) {}
    public record Decision(@NotNull @Positive Long revision,@NotNull Boolean aprobar,
        @NotBlank @Size(min=5,max=500) String motivo) {}
    public record Punto(@NotNull @DecimalMin("-85") @DecimalMax("85") Double latitud,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitud,
        Double precision,OffsetDateTime capturadoEn) {}
    public record Solicitud(long id,long tecnicoId,long revision,String estado,String motivo,JsonNode zonas,
        OffsetDateTime creadaEn,OffsetDateTime revisadaEn,String motivoRevision) {}
    public record Vista(long revision,JsonNode zonas,List<String> especialidades,List<Solicitud> solicitudes,
        long totalSolicitudes,int pagina) {}
    public record Pertenencia(String estado,boolean dentro,Double distanciaLimiteMetros,long revision) {}
}

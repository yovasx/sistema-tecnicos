package com.tecnicos.tecnicos_backend.orders.api;

import jakarta.validation.constraints.*;
import java.time.*;
import java.util.List;

public final class AtencionDtos {
    private AtencionDtos() {}
    public record Evento(long id,String accion,String motivo,String actor,OffsetDateTime creadoEn) {}
    public record Atencion(long orden,long revision,String estado,String busqueda,OffsetDateTime busquedaHasta,int intento,
        String pausaMotivo,OffsetDateTime reanudarEn,String incidencia,OffsetDateTime llegadaVerificadaEn,
        String trabajoRealizado,OffsetDateTime entregadoEn,String conformidad,String respuestaCliente,
        LocalDate proximoMantenimiento,boolean evidenciaDisponible,String equipo,String sucursal,List<Evento> eventos) {}
    public record Revision(@NotNull @PositiveOrZero Long revision) {}
    public record Codigo(@NotBlank @Pattern(regexp="\\d{8}",message="Escribe las ocho cifras del código.") String codigo) {}
    public record Accion(@NotNull @PositiveOrZero Long revision,
        @NotBlank String accion,
        @NotBlank @Size(min=10,max=1000,message="Usa entre 10 y 1000 caracteres.") String motivo,
        OffsetDateTime fecha) {}
    public record Conformidad(@NotNull @PositiveOrZero Long revision,@NotNull Boolean conforme,
        @NotBlank @Size(min=10,max=1000,message="Usa entre 10 y 1000 caracteres.") String comentario) {}
    public record Candidato(long tecnico,String nombre,String especialidad,boolean cobertura,boolean disponible,
        boolean sinServicio,java.math.BigDecimal distanciaMetros,java.math.BigDecimal reputacion,
        OffsetDateTime ultimaAsignacion) {}
}

package com.tecnicos.tecnicos_backend.admin.api;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Resumen operativo acotado; sin contactos, ubicación ni importes supuestos. */
public record DashboardAdmin(
        OffsetDateTime generadoEn, LocalDate desde, LocalDate hasta,
        Metricas metricas, List<Dia> solicitudesPorDia,
        List<Solicitud> solicitudesPendientes, List<Expediente> expedientesPendientes) {
    public record Metricas(long ordenesAbiertas, long solicitudesSinAsignar, long expedientesEnRevision,
                           long tecnicosActivosAprobados, long usuariosActivos, long categoriasActivas) {}
    public record Dia(LocalDate fecha, long solicitudes) {}
    public record Solicitud(long id, String categoria, boolean urgencia, OffsetDateTime creadoEn) {}
    public record Expediente(long id, String nombre, OffsetDateTime enviadoEn) {}
}

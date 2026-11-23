package com.tecnicos.tecnicos_backend.admin.api;

import java.time.OffsetDateTime;
import java.util.List;

/** Proyecciones explícitas: el listado no incluye ubicación, contactos ni evidencia. */
public final class OrdenesAdminDtos {
    private OrdenesAdminDtos() {}

    public record Pagina<T>(List<T> elementos, long total, int pagina, int tamano) {}
    public record Categoria(int id, String nombre) {}
    public record Persona(Long id, String nombre, boolean activo, boolean eliminada) {}
    public record Contacto(Persona persona, String email, String telefono) {}
    public record Ubicacion(double latitud, double longitud) {}
    public record Fila(long id, Categoria categoria, Persona cliente, Persona tecnico,
                       String estado, boolean tarifaUrgencia, OffsetDateTime creadoEn) {}
    public record Cancelacion(String motivo, Persona autor, OffsetDateTime canceladoEn) {}
    public record Detalle(long id, Categoria categoria, Contacto cliente, Contacto tecnico,
                          String estado, boolean tarifaUrgencia, String descripcionFalla,
                          String direccionReferencia, Ubicacion ubicacion, OffsetDateTime creadoEn,
                          OffsetDateTime asignadoEn, OffsetDateTime llegadaEstimadaEn,
                          OffsetDateTime llegadaEn, OffsetDateTime finalizadoEn,
                          OffsetDateTime actualizadoEn, Cancelacion cancelacion) {}
    public record Transicion(long id, String estadoAnterior, String estadoNuevo,
                             Persona autor, String observacion, OffsetDateTime registradoEn) {}
}

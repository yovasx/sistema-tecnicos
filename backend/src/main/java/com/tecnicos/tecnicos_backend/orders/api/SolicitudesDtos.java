package com.tecnicos.tecnicos_backend.orders.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Contratos de la solicitud de servicio del cliente.
 *
 * <p>El listado no incluye dirección, coordenadas, contactos ni URLs de
 * archivos: el detalle y la evidencia se piden aparte y con autenticación.</p>
 */
public final class SolicitudesDtos {
    private SolicitudesDtos() {}

    public record CrearResultado(long id, String estado, boolean creada) {}

    public record Pagina<T>(List<T> elementos, long total, int pagina, int tamano) {}

    public record Categoria(int id, String nombre, String descripcion,
                            BigDecimal tarifaVisita, BigDecimal tarifaHora, String moneda) {}

    public record Fila(long id, int categoriaId, String categoria, String estado, boolean urgencia,
                       OffsetDateTime creadoEn) {}

    /** Línea de facturación: la última cotización aceptada de una orden propia. */
    public record LineaFacturacion(long orden, String categoria, String estadoOrden, String tecnico,
                                   BigDecimal total, String moneda, OffsetDateTime aceptadaEn) {}

    /** Solo importes reales de cotizaciones aceptadas; no hay cobros ni comprobantes emitidos. */
    public record Facturacion(BigDecimal totalAceptado, String moneda, List<LineaFacturacion> lineas) {}

    public record Detalle(long id, int categoriaId, String categoria, String estado, boolean urgencia,
                          String descripcion, String referencia, double latitud, double longitud,
                          boolean evidenciaDisponible, String evidenciaExtension,
                          OffsetDateTime creadoEn, OffsetDateTime asignadoEn,
                          OffsetDateTime llegadaEstimadaEn, OffsetDateTime llegadaEn,
                          OffsetDateTime finalizadoEn, String tecnico,
                          String motivoCancelacion, OffsetDateTime canceladoEn,
                          Integer miCalificacion,
                          /** Técnicos a los que se envió la solicitud y cuántos siguen pendientes. */
                          int ofertasEnviadas, int ofertasPendientes) {}
}

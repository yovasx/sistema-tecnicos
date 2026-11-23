package com.tecnicos.tecnicos_backend.admin.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Contratos de los módulos operativos del backoffice. */
public final class BackofficeDtos {
    private BackofficeDtos() {}

    public record Pagina<T>(List<T> elementos, long total, int pagina, int tamano) {}

    public record Auditoria(long id, String origen, String sujeto, Long sujetoId,
                            String actor, Long actorId, String accion, String motivo,
                            Map<String, Object> detalle, OffsetDateTime creadoEn) {}

    public record MensajeModerado(long id, long orden, String categoria, String emisor, String receptor,
                                  String contenido, boolean revisado, String decision, String nota,
                                  OffsetDateTime enviadoEn, OffsetDateTime revisadoEn) {}

    public record RevisionMensaje(
        @NotBlank(message = "Selecciona una decisión.")
        @Pattern(regexp = "sin_accion|advertencia", message = "La decisión no es válida.")
        String decision,
        @Size(max = 500, message = "La nota no puede superar 500 caracteres.")
        String nota) {}

    public record NotificacionSistema(long id, long usuarioId, String usuario, Long orden,
                                      String tipo, String mensaje, boolean leido,
                                      OffsetDateTime enviadoEn) {}

    public record LiquidacionAdmin(long id, long orden, String tecnico, BigDecimal bruto,
                                   BigDecimal comisionPct, BigDecimal comision, BigDecimal neto,
                                   String estado, OffsetDateTime creadaEn, OffsetDateTime liquidadaEn) {}

    public record PuntoActivo(long orden, String categoria, String estado, boolean urgencia,
                              String tecnico, double latitudCliente, double longitudCliente,
                              Double latitudTecnico, Double longitudTecnico,
                              OffsetDateTime posicionEn, OffsetDateTime creadoEn) {}

    public record ResumenOperativo(long ofertasPendientes, long solicitudesSinTecnico,
                                   long tecnicosDisponibles, long disputasAbiertas,
                                   long mensajesPorRevisar) {}
}

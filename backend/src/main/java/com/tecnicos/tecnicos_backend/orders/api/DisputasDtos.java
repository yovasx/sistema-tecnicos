package com.tecnicos.tecnicos_backend.orders.api;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;

/** Contratos de disputas: las abre un participante y las resuelve un administrador. */
public final class DisputasDtos {
    private DisputasDtos() {}

    public record Disputa(long id, long orden, String categoria, String estado, String motivo,
                          String resolucion, String abiertaPor, String contraUsuario,
                          String administrador, OffsetDateTime abiertaEn, OffsetDateTime resueltaEn) {}

    public record Pagina(List<Disputa> elementos, long total, int pagina, int tamano) {}

    public record Nueva(@NotNull(message = "Selecciona la orden.")
                        @Positive(message = "La orden no es válida.") Long orden,
                        @NotBlank(message = "Describe el motivo.")
                        @Size(min = 10, max = 1000, message = "Usa entre 10 y 1000 caracteres.")
                        String motivo) {}

    public record Revision(
        @NotBlank(message = "Selecciona el estado.")
        @Pattern(regexp = "en_revision|resuelta", message = "El estado no es válido.")
        String estado,
        @Size(max = 2000, message = "La resolución no puede superar 2000 caracteres.")
        String resolucion) {}
}

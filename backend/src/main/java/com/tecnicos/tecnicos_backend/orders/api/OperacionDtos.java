package com.tecnicos.tecnicos_backend.orders.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class OperacionDtos {
    private OperacionDtos() {}
    public record Servicio(long id,String categoria,String estado,boolean urgencia,OffsetDateTime creadoEn) {}
    public record TecnicoPanel(String disponibilidad,long finalizados,long activos,List<Servicio> solicitudes) {}
    public record DetalleTecnico(long id,String categoria,String estado,String descripcion,String referencia,
        double latitud,double longitud,String cliente,OffsetDateTime creadoEn,Integer miCalificacion) {}
    public record Motivo(@NotBlank(message="Describe el motivo.")
        @Size(min=5,max=500,message="Usa entre 5 y 500 caracteres.") String motivo) {}
    public record Disponibilidad(@NotNull(message="Selecciona tu disponibilidad.") Boolean disponible) {}
    public record Item(String tipo,String descripcion,BigDecimal cantidad,BigDecimal precioUnitario,BigDecimal subtotal) {}
    public record Cotizacion(long id,int version,String estado,String motivo,BigDecimal total,String moneda,
        OffsetDateTime expiraEn,List<Item> items) {}
    public record ItemNuevo(
        @NotBlank(message="Selecciona el tipo de concepto.")
        @Pattern(regexp="visita|mano_obra|repuesto|desplazamiento|urgencia|otro",message="El concepto no es válido.") String tipo,
        @NotBlank(message="Describe el concepto.") @Size(min=2,max=200,message="Usa entre 2 y 200 caracteres.") String descripcion,
        @NotNull(message="Indica la cantidad.") @DecimalMin(value="0.01",message="La cantidad debe ser positiva.")
        @DecimalMax(value="999999.99",message="La cantidad excede el máximo.") @Digits(integer=6,fraction=2,message="Usa hasta 2 decimales.") BigDecimal cantidad,
        @NotNull(message="Indica el precio.") @DecimalMin(value="0",message="El precio no puede ser negativo.")
        @DecimalMax(value="99999999.99",message="El precio excede el máximo.") @Digits(integer=8,fraction=2,message="Usa hasta 2 decimales.") BigDecimal precioUnitario) {}
    public record NuevaCotizacion(@NotNull(message="La clave de cotización no es válida.") UUID clave,
        @NotBlank(message="Describe el diagnóstico.") @Size(min=5,max=1000,message="Usa entre 5 y 1000 caracteres.") String motivo,
        @NotNull(message="Agrega los conceptos.") @Size(min=1,max=20,message="Agrega entre 1 y 20 conceptos.") List<@Valid ItemNuevo> items) {}
    public record Respuesta(@NotNull(message="Confirma tu decisión.") Boolean acepta,
        @Size(max=500,message="El motivo no puede superar 500 caracteres.") String motivo) {}
    public record Liquidacion(long id,long orden,BigDecimal bruto,BigDecimal comision,BigDecimal neto,
        String moneda,String estado,OffsetDateTime creadaEn) {}
}

package com.tecnicos.tecnicos_backend.identity.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** La dirección siempre pertenece al usuario del JWT; el id no viaja al alta. */
public final class DireccionesDtos {
    private DireccionesDtos() {}

    public record Fila(long id, String etiqueta, String referencia, double latitud,
                       double longitud, boolean predeterminada) {}

    public record Guardar(
        @NotBlank(message="Escribe una etiqueta para la dirección.")
        @Size(max=40,message="La etiqueta no puede superar los 40 caracteres.") String etiqueta,
        @NotBlank(message="Ingresa la dirección o una referencia.")
        @Size(min=5,max=300,message="La dirección debe tener entre 5 y 300 caracteres.") String referencia,
        @NotNull(message="Selecciona la ubicación en el mapa.")
        @DecimalMin(value="-90",message="La latitud no es válida.")
        @DecimalMax(value="90",message="La latitud no es válida.") Double latitud,
        @NotNull(message="Selecciona la ubicación en el mapa.")
        @DecimalMin(value="-180",message="La longitud no es válida.")
        @DecimalMax(value="180",message="La longitud no es válida.") Double longitud,
        @NotNull(message="Indica si es tu dirección predeterminada.") Boolean predeterminada) {}
}

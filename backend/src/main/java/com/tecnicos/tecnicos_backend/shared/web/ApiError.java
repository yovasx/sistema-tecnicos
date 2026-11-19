package com.tecnicos.tecnicos_backend.shared.web;

import java.util.List;

/**
 * Forma única de error de la API. La app solo necesita leer esto.
 *
 * @param codigo  identificador estable, p. ej. {@code EMAIL_DUPLICADO}
 * @param mensaje texto en español listo para mostrar al usuario
 * @param campos  errores de validación campo a campo; vacío si no aplica
 */
public record ApiError(String codigo, String mensaje, List<CampoError> campos) {

    public record CampoError(String campo, String mensaje) {
    }

    public static ApiError de(String codigo, String mensaje) {
        return new ApiError(codigo, mensaje, List.of());
    }

    public static ApiError de(String codigo, String mensaje, List<CampoError> campos) {
        return new ApiError(codigo, mensaje, campos == null ? List.of() : campos);
    }
}

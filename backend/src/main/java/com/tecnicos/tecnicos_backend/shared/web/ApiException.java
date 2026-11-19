package com.tecnicos.tecnicos_backend.shared.web;

import org.springframework.http.HttpStatus;

/**
 * Error de negocio que ya sabe qué código y qué estado HTTP devolver.
 *
 * <p>Evita crear una excepción por caso y mantiene el formato {@link ApiError}
 * en un solo lugar. El mensaje debe estar redactado en español y ser apto para
 * mostrar al usuario.</p>
 */
public class ApiException extends RuntimeException {

    private final HttpStatus estado;
    private final String codigo;

    public ApiException(HttpStatus estado, String codigo, String mensaje) {
        super(mensaje);
        this.estado = estado;
        this.codigo = codigo;
    }

    public HttpStatus estado() {
        return estado;
    }

    public String codigo() {
        return codigo;
    }
}

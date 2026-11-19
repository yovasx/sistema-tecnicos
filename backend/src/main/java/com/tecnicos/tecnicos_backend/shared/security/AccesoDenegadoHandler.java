package com.tecnicos.tecnicos_backend.shared.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Respuesta para un usuario autenticado que no tiene el rol necesario.
 *
 * <p>Mantiene el mismo formato {@code {codigo, mensaje, campos[]}} que el resto
 * de la API para que la app no tenga dos maneras de leer errores.</p>
 */
@Component
public class AccesoDenegadoHandler implements AccessDeniedHandler {

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accesoDenegado) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(
                "{\"codigo\":\"PERMISO_INSUFICIENTE\","
                        + "\"mensaje\":\"No tenés permiso para realizar esta acción.\","
                        + "\"campos\":[]}");
    }
}

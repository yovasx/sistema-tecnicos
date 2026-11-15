package com.tecnicos.tecnicos_backend.shared.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Respuesta única para cualquier petición sin autenticación válida.
 *
 * <p>No se distingue entre token ausente, vencido, mal firmado o con claims
 * inválidos: todos responden {@code 401 NO_AUTENTICADO}. Así el cliente sabe
 * exactamente qué hacer (mandar al login) y no se filtra por qué falló.</p>
 */
@Component
public class AutenticacionEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(
                "{\"codigo\":\"NO_AUTENTICADO\","
                        + "\"mensaje\":\"Necesitás iniciar sesión.\","
                        + "\"campos\":[]}");
    }
}

package com.tecnicos.tecnicos_backend.shared.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración del token JWT ({@code app.jwt.*}).
 *
 * @param secret     secreto en Base64; vacío en desarrollo usa el secreto de respaldo
 * @param issuer     emisor que se escribe en el claim {@code iss}
 * @param ttlMinutes minutos de vida del token
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, String issuer, int ttlMinutes) {
}

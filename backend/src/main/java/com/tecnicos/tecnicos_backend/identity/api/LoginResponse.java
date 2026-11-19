package com.tecnicos.tecnicos_backend.identity.api;

import java.time.Instant;

/**
 * Respuesta del login: el token y lo mínimo para pintar la sesión.
 *
 * @param token    JWT para enviar como {@code Authorization: Bearer ...}
 * @param expiraEn instante de vencimiento del token
 * @param usuario  datos del usuario autenticado
 */
public record LoginResponse(String token, Instant expiraEn, UsuarioResumen usuario) {
}

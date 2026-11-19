package com.tecnicos.tecnicos_backend.shared.security;

import java.time.Instant;

/**
 * Token firmado listo para devolver al cliente.
 *
 * @param token    valor del JWT (se envía como {@code Authorization: Bearer ...})
 * @param expiraEn instante exacto de vencimiento, tomado del propio token
 */
public record TokenGenerado(String token, Instant expiraEn) {
}

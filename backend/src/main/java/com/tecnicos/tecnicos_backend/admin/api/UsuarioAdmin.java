package com.tecnicos.tecnicos_backend.admin.api;

import java.time.OffsetDateTime;

/**
 * Fila de {@code GET /api/admin/usuarios}.
 *
 * <p>El nombre visible sigue la regla de la app: razón social si es empresa,
 * nombre de la persona si no. Nunca lleva hash de contraseña.</p>
 */
public record UsuarioAdmin(
        Long id,
        String nombre,
        String email,
        String rol,
        String tipoCliente,
        Boolean activo,
        OffsetDateTime creadoEn) {
}

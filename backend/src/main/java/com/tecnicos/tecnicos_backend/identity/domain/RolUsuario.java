package com.tecnicos.tecnicos_backend.identity.domain;

/**
 * Espejo exacto de identity.rol_usuario.
 * Los valores van en minúsculas porque así están guardados en Postgres.
 */
public enum RolUsuario {
    cliente,
    tecnico,
    administrador
}

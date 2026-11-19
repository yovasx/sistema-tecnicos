package com.tecnicos.tecnicos_backend.identity.domain;

/**
 * Espejo exacto de identity.tipo_cliente.
 *
 * <p>No es un rol: el rol de una empresa sigue siendo {@link RolUsuario#cliente}.
 * El perfil define qué casos de uso ve la app (facturación con NIT, cuentas de
 * empresa) sin tocar las reglas de autorización de la base.</p>
 */
public enum TipoCliente {
    persona,
    empresa
}

package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import org.springframework.security.core.AuthenticatedPrincipal;

/**
 * Principal de la aplicación: lo que el resto del backend necesita del usuario
 * autenticado, sin tener que volver a leer los claims del JWT.
 *
 * <p>Implementa {@link AuthenticatedPrincipal} para que el nombre de la
 * autenticación sea el email en lugar del {@code sub} numérico.</p>
 */
public record UsuarioAutenticado(Long id, RolUsuario rol, String nombre, String email)
        implements AuthenticatedPrincipal {

    @Override
    public String getName() {
        return email;
    }
}

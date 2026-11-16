package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;

/**
 * Datos del usuario que la app necesita después del login. Nunca incluye el
 * hash de la contraseña.
 */
public record UsuarioResumen(Long id, String nombre, String email, RolUsuario rol) {

    public static UsuarioResumen de(Usuario usuario) {
        return new UsuarioResumen(
                usuario.getId(),
                usuario.getNombreCompleto(),
                usuario.getEmail(),
                usuario.getRol());
    }
}

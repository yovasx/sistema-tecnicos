package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;

/**
 * Datos del usuario que la app necesita después del login. Nunca incluye el
 * hash de la contraseña.
 *
 * <p>{@code nombre} es el nombre visible: la razón social cuando el cliente es
 * una empresa. {@code tipoCliente} distingue los dos perfiles de cliente sin
 * cambiar el rol de autorización.</p>
 */
public record UsuarioResumen(Long id, String nombre, String email, RolUsuario rol,
                             TipoCliente tipoCliente, String razonSocial, String nit) {

    public static UsuarioResumen de(Usuario usuario) {
        return new UsuarioResumen(
                usuario.getId(),
                usuario.getNombreVisible(),
                usuario.getEmail(),
                usuario.getRol(),
                usuario.getTipoCliente(),
                usuario.getRazonSocial(),
                usuario.getNit());
    }
}

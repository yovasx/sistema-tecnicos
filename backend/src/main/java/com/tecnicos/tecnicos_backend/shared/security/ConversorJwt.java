package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * Convierte el JWT ya verificado en la autenticación de Spring Security.
 *
 * <p>El claim {@code rol} está en minúsculas, igual que el enum de Postgres,
 * pero las autoridades usan el prefijo {@code ROLE_} en mayúsculas para que
 * {@code hasRole("TECNICO")} funcione sin traducciones.</p>
 */
@Component
public class ConversorJwt implements Converter<Jwt, AbstractAuthenticationToken> {
    private final VersionSesion versiones;
    public ConversorJwt(VersionSesion versiones) { this.versiones=versiones; }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Long actual=versiones.actual(Long.valueOf(jwt.getSubject()));
        Object valor=jwt.getClaims().get("versionSesion");
        long version=valor instanceof Number n?n.longValue():0L;
        if (actual==null || actual!=version) {
            throw new org.springframework.security.oauth2.server.resource.InvalidBearerTokenException("La sesión venció.");
        }
        RolUsuario rol = RolUsuario.valueOf(jwt.getClaimAsString("rol"));
        TipoCliente tipoCliente = TipoCliente.valueOf(jwt.getClaimAsString("tipoCliente"));
        UsuarioAutenticado usuario = new UsuarioAutenticado(
                Long.valueOf(jwt.getSubject()),
                rol,
                tipoCliente,
                jwt.getClaimAsString("nombre"),
                jwt.getClaimAsString("email"));

        List<GrantedAuthority> autoridades = List.of(
                new SimpleGrantedAuthority("ROLE_" + rol.name().toUpperCase(Locale.ROOT)));

        return new JwtAuthenticationToken(jwt, usuario, autoridades);
    }
}

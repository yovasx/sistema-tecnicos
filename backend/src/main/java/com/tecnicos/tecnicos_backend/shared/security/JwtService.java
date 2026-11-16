package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Firma los tokens de sesión.
 *
 * <p>Los claims son deliberadamente mínimos: el backend no debe necesitar la
 * base para saber quién llama. {@code sub} lleva el ID, y {@code rol},
 * {@code tipoCliente}, {@code nombre} y {@code email} alcanzan para la UI y
 * para las reglas de autorización.</p>
 */
@Service
public class JwtService {

    private final JwtEncoder codificador;
    private final JwtProperties propiedades;

    public JwtService(JwtEncoder codificador, JwtProperties propiedades) {
        this.codificador = codificador;
        this.propiedades = propiedades;
    }

    public TokenGenerado generar(Long usuarioId, RolUsuario rol, TipoCliente tipoCliente,
                                 String nombre, String email) {
        // El claim NumericDate del JWT tiene precisión de segundos: se trunca acá
        // para que el vencimiento devuelto sea idéntico al que se lee del token.
        Instant emitidoEn = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant expiraEn = emitidoEn.plus(Duration.ofMinutes(propiedades.ttlMinutes()));

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(propiedades.issuer())
                .subject(String.valueOf(usuarioId))
                .issuedAt(emitidoEn)
                .expiresAt(expiraEn)
                .claim("rol", rol.name())
                .claim("tipoCliente", tipoCliente.name())
                .claim("nombre", nombre)
                .claim("email", email)
                .build();

        Jwt jwt = codificador.encode(JwtEncoderParameters.from(claims));
        return new TokenGenerado(jwt.getTokenValue(), jwt.getExpiresAt());
    }
}

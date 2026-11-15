package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

/**
 * Configuración del JWT HS256.
 *
 * <p>Se usa una clave simétrica porque el mismo backend firma y verifica los
 * tokens; no hay un servidor de autorización separado.</p>
 *
 * <p><b>Secreto</b>: en producción se inyecta con {@code JWT_SECRET}. Si está
 * vacío se usa el secreto de desarrollo y se registra un aviso, para que el
 * arranque local no dependa de variables de entorno.</p>
 */
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {

    private static final Logger log = LoggerFactory.getLogger(JwtConfig.class);

    /** Solo desarrollo local. 37 bytes decodificados, supera los 32 que exige HS256. */
    private static final String SECRETO_DESARROLLO =
            "Zml4bHktZGVzYXJyb2xsby1zb2xhbWVudGUtMzItYnl0ZXMhIQ==";

    private static final int TAMANO_MINIMO_SECRETO = 32;

    @Bean
    SecretKey claveJwt(JwtProperties propiedades) {
        String secreto = propiedades.secret();
        if (secreto == null || secreto.isBlank()) {
            log.warn("JWT_SECRET no esta definido: se usa el secreto de desarrollo. "
                    + "Configuralo en produccion para no aceptar tokens firmados por cualquiera.");
            secreto = SECRETO_DESARROLLO;
        }

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(secreto);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(
                    "app.jwt.secret (JWT_SECRET) debe ser un texto Base64 valido.", ex);
        }

        if (bytes.length < TAMANO_MINIMO_SECRETO) {
            throw new IllegalStateException(
                    "app.jwt.secret (JWT_SECRET) debe decodificar a al menos "
                            + TAMANO_MINIMO_SECRETO + " bytes (256 bits) para firmar con HS256. "
                            + "Tiene " + bytes.length + " bytes.");
        }

        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder codificadorJwt(SecretKey claveJwt) {
        return NimbusJwtEncoder.withSecretKey(claveJwt)
                .algorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    JwtDecoder decodificadorJwt(SecretKey claveJwt, JwtProperties propiedades) {
        validarEmisor(propiedades.issuer());
        NimbusJwtDecoder decodificador = NimbusJwtDecoder.withSecretKey(claveJwt)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decodificador.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                // Firma, vencimiento y emisor: el emisor evita aceptar tokens de otro servicio.
                JwtValidators.createDefaultWithIssuer(propiedades.issuer()),
                validadorDeClaims()));
        return decodificador;
    }

    /**
     * Spring Security compara el claim {@code iss} como URL; si el emisor no lo
     * es, cada petición autenticada terminaría en 500. Mejor fallar al arrancar.
     */
    private void validarEmisor(String emisor) {
        try {
            java.net.URI uri = new java.net.URI(emisor);
            boolean http = "http".equals(uri.getScheme()) || "https".equals(uri.getScheme());
            if (!uri.isAbsolute() || !http) {
                throw new IllegalArgumentException("no es una URL http(s) absoluta");
            }
        } catch (java.net.URISyntaxException | IllegalArgumentException ex) {
            throw new IllegalStateException(
                    "app.jwt.issuer (JWT_ISSUER) debe ser una URL valida, "
                            + "por ejemplo https://api.fixly.bo. Valor actual: " + emisor, ex);
        }
    }

    /**
     * Si un token firmado trae claims incompletos o un rol desconocido, se
     * rechaza como token invalido (401) en lugar de estallar en el conversor
     * con un error 500.
     */
    private OAuth2TokenValidator<Jwt> validadorDeClaims() {
        return jwt -> {
            if (tieneClaimsValidos(jwt)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                    "invalid_token", "El token no contiene los datos esperados.", null));
        };
    }

    private boolean tieneClaimsValidos(Jwt jwt) {
        return esIdValido(jwt.getSubject())
                && esRolValido(jwt.getClaimAsString("rol"))
                && esTextoValido(jwt.getClaimAsString("nombre"))
                && esTextoValido(jwt.getClaimAsString("email"));
    }

    private boolean esIdValido(String sub) {
        if (!esTextoValido(sub)) {
            return false;
        }
        try {
            return Long.parseLong(sub) > 0;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private boolean esRolValido(String rol) {
        if (!esTextoValido(rol)) {
            return false;
        }
        for (RolUsuario valor : RolUsuario.values()) {
            if (valor.name().equals(rol)) {
                return true;
            }
        }
        return false;
    }

    private boolean esTextoValido(String texto) {
        return texto != null && !texto.isBlank();
    }
}

package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El token que firma el backend tiene que poder verificarse con su propio
 * decoder y llevar exactamente los datos que espera el conversor.
 */
class JwtServiceTest {

    private static final String SECRETO =
            "Zml4bHktZGVzYXJyb2xsby1zb2xhbWVudGUtMzItYnl0ZXMhIQ==";

    private final JwtProperties propiedades =
            new JwtProperties(SECRETO, "https://api.fixly.bo", 30);
    private final JwtConfig configuracion = new JwtConfig();
    private final SecretKey clave = configuracion.claveJwt(propiedades);
    private final JwtEncoder codificador = configuracion.codificadorJwt(clave);
    private final JwtDecoder decodificador = configuracion.decodificadorJwt(clave, propiedades);
    private final JwtService servicio = new JwtService(codificador, propiedades);

    @Test
    void el_token_lleva_los_claims_que_necesita_la_app() {
        TokenGenerado generado = servicio.generar(
                7L, RolUsuario.tecnico, "Carlos Mamani", "carlos@fixly.bo");

        Jwt jwt = decodificador.decode(generado.token());

        assertThat(jwt.getSubject()).isEqualTo("7");
        assertThat(jwt.getClaimAsString("rol")).isEqualTo("tecnico");
        assertThat(jwt.getClaimAsString("nombre")).isEqualTo("Carlos Mamani");
        assertThat(jwt.getClaimAsString("email")).isEqualTo("carlos@fixly.bo");
        assertThat(jwt.getIssuer().toString()).isEqualTo("https://api.fixly.bo");
        assertThat(jwt.getIssuedAt()).isNotNull();
    }

    @Test
    void el_vencimiento_respeta_el_ttl_configurado() {
        Instant antes = Instant.now();

        TokenGenerado generado = servicio.generar(
                7L, RolUsuario.cliente, "Ana Quispe", "ana@fixly.bo");

        assertThat(generado.expiraEn())
                .isAfter(antes.plus(Duration.ofMinutes(29)))
                .isBefore(Instant.now().plus(Duration.ofMinutes(31)));
        assertThat(decodificador.decode(generado.token()).getExpiresAt())
                .isEqualTo(generado.expiraEn());
    }

    @Test
    void el_rol_se_guarda_en_minusculas_igual_que_en_postgres() {
        TokenGenerado generado = servicio.generar(
                1L, RolUsuario.administrador, "Admin Fixly", "admin@fixly.bo");

        assertThat(decodificador.decode(generado.token()).getClaimAsString("rol"))
                .isEqualTo("administrador");
    }
}

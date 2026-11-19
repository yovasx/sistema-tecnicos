package com.tecnicos.tecnicos_backend.shared.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contrato de seguridad (SCRUM-14): toda la API exige un JWT válido y los
 * rechazos usan el mismo formato de error que el resto de la API.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeguridadJwtTest {

    private static final String CLAVE_AJENA = "otra-clave-de-32-bytes-para-probar!!";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtEncoder codificador;

    @Autowired
    private JwtProperties propiedades;

    @Test
    void sin_token_responde_401_con_el_formato_de_error_de_la_api() throws Exception {
        mvc.perform(get("/api/ordenes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"))
                .andExpect(jsonPath("$.mensaje").value("Necesitás iniciar sesión."))
                .andExpect(jsonPath("$.campos").isEmpty());
    }

    @Test
    void un_token_que_no_es_jwt_responde_401() throws Exception {
        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer esto-no-es-un-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    @Test
    void un_token_firmado_con_otra_clave_responde_401() throws Exception {
        SecretKey claveAjena = new SecretKeySpec(
                CLAVE_AJENA.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        JwtEncoder codificadorAjeno = NimbusJwtEncoder.withSecretKey(claveAjena)
                .algorithm(MacAlgorithm.HS256)
                .build();
        String token = codificadorAjeno
                .encode(JwtEncoderParameters.from(claimsValidos().build()))
                .getTokenValue();

        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    @Test
    void un_token_vencido_responde_401() throws Exception {
        String token = firmar(claimsValidos()
                .issuedAt(Instant.now().minus(Duration.ofHours(2)))
                .expiresAt(Instant.now().minus(Duration.ofHours(1))));

        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    @Test
    void un_token_de_otro_emisor_responde_401() throws Exception {
        String token = firmar(claimsValidos().issuer("otro-servicio"));

        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void un_token_con_rol_desconocido_responde_401_y_no_500() throws Exception {
        String token = firmar(claimsValidos().claim("rol", "superadmin"));

        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void un_token_con_perfil_desconocido_responde_401_y_no_500() throws Exception {
        String token = firmar(claimsValidos().claim("tipoCliente", "ong"));

        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void un_token_sin_perfil_responde_401() throws Exception {
        String token = firmar(claimsValidos().claims(claims -> claims.remove("tipoCliente")));

        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void un_token_valido_pasa_seguridad_y_solo_la_autorizacion_lo_rechaza() throws Exception {
        String token = firmar(claimsValidos());

        // El token de técnico es válido: la seguridad lo autentica y solo la
        // autorización por rol lo rechaza en una ruta exclusiva de clientes.
        mvc.perform(get("/api/ordenes").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void ping_sigue_abierto_sin_token() throws Exception {
        mvc.perform(get("/api/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void el_login_esta_abierto_y_valida_el_cuerpo_sin_pedir_token() throws Exception {
        // Sin token llega al controlador: 400 por datos faltantes, no 401.
        mvc.perform(post("/api/auth/login"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    private JwtClaimsSet.Builder claimsValidos() {
        Instant ahora = Instant.now();
        return JwtClaimsSet.builder()
                .issuer(propiedades.issuer())
                .subject("1")
                .issuedAt(ahora)
                .expiresAt(ahora.plus(Duration.ofMinutes(5)))
                .claim("rol", "tecnico")
                .claim("tipoCliente", "persona")
                .claim("nombre", "Carlos Mamani")
                .claim("email", "carlos@fixly.bo");
    }

    private String firmar(JwtClaimsSet.Builder claims) {
        return codificador.encode(JwtEncoderParameters.from(claims.build())).getTokenValue();
    }
}

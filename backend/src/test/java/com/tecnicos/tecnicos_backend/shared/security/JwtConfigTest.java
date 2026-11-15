package com.tecnicos.tecnicos_backend.shared.security;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * La configuración del JWT falla al arrancar, no en la primera petición: es
 * preferible un error claro en el log a un 500 cuando un usuario intenta entrar.
 */
class JwtConfigTest {

    private static final String SECRETO_VALIDO =
            "Zml4bHktZGVzYXJyb2xsby1zb2xhbWVudGUtMzItYnl0ZXMhIQ==";
    private static final String EMISOR_VALIDO = "https://api.fixly.bo";

    private final JwtConfig configuracion = new JwtConfig();

    @Test
    void un_secreto_de_menos_de_32_bytes_no_deja_arrancar() {
        String corto = Base64.getEncoder()
                .encodeToString("corto".getBytes(StandardCharsets.UTF_8));
        JwtProperties propiedades = new JwtProperties(corto, EMISOR_VALIDO, 30);

        assertThatThrownBy(() -> configuracion.claveJwt(propiedades))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("al menos 32 bytes");
    }

    @Test
    void un_secreto_que_no_es_base64_no_deja_arrancar() {
        JwtProperties propiedades = new JwtProperties("no-es-base64!!", EMISOR_VALIDO, 30);

        assertThatThrownBy(() -> configuracion.claveJwt(propiedades))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Base64");
    }

    @Test
    void un_emisor_que_no_es_url_no_deja_arrancar() {
        JwtProperties propiedades = new JwtProperties(SECRETO_VALIDO, "tecnicos-api", 30);

        assertThatThrownBy(() ->
                configuracion.decodificadorJwt(configuracion.claveJwt(propiedades), propiedades))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("URL");
    }

    @Test
    void sin_secreto_usa_el_de_desarrollo_para_no_frenar_el_arranque_local() {
        JwtProperties propiedades = new JwtProperties("", EMISOR_VALIDO, 30);

        configuracion.claveJwt(propiedades);
    }
}

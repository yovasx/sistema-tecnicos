package com.tecnicos.tecnicos_backend.shared.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MensajesNeutralesTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;

    @Test void funciones_vigentes_usan_espanol_neutral_sin_reescribir_migraciones_historicas() {
        var funciones=jdbc.queryForList("""
            SELECT n.nspname||'.'||p.proname FROM pg_proc p
            JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname IN ('identity','orders','admin_svc','geo','billing','chat','reputation','notification')
                AND p.prokind='f' AND p.prosrc ~* ?
            """,String.class,
            "\\m(ingresá|iniciá|revisá|completá|elegí|recargá|usá|intentá|resolvelas|consultá|verificá|podés|tenés|necesitás|querés|escribí|definí)\\M");
        assertThat(funciones).isEmpty();
    }
    @Test void error_de_sesion_usa_texto_neutral() throws Exception {
        mvc.perform(get("/api/perfil")).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.mensaje").value("Necesitas iniciar sesión."));
    }
}

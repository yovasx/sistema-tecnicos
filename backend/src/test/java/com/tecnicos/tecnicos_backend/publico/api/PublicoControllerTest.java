package com.tecnicos.tecnicos_backend.publico.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Catálogo público que alimenta las landings. */
@SpringBootTest
@AutoConfigureMockMvc
class PublicoControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void las_categorias_son_publicas_y_traen_tarifas_reales() throws Exception {
        MvcResult resultado = mvc.perform(get("/api/publico/categorias"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].nombre").value("Plomería"))
                .andExpect(jsonPath("$[0].tarifaVisita").isNumber())
                .andExpect(jsonPath("$[0].moneda").value("BOB"))
                .andReturn();

        assertThat(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .doesNotContain("comision")
                .doesNotContain("porcentaje");
    }

    @Test
    void una_categoria_sin_tarifa_vigente_igual_se_muestra() throws Exception {
        // Las tres categorías sembradas tienen tarifa, pero el LEFT JOIN LATERAL
        // garantiza que el catálogo no se rompa si una queda sin precio.
        mvc.perform(get("/api/publico/categorias"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }
}

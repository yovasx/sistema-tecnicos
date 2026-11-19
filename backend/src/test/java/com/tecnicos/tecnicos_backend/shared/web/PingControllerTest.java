package com.tecnicos.tecnicos_backend.shared.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SCRUM-46: la app móvil distingue conectado / sin conexión / error del
 * servidor a partir de este endpoint, así que tiene que consultar la base de
 * verdad y no devolver un "ok" fijo.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PingControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void ping_responde_200_con_estado_real_de_la_base() throws Exception {
        mvc.perform(get("/api/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.base").value("ok"))
                .andExpect(jsonPath("$.service").value("tecnicos-backend"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    void el_resto_de_la_api_exige_un_token_valido() throws Exception {
        // Sin token, la API responde 401 con el formato de error uniforme.
        mvc.perform(get("/api/ordenes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }
}

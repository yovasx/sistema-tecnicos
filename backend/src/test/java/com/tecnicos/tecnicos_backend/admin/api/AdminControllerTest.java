package com.tecnicos.tecnicos_backend.admin.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * El backoffice exige rol administrador y devuelve datos reales de los seeds.
 * La clase es transaccional: nada de lo que lee se escribe.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminControllerTest {

    private static final String EMAIL_ADMIN = "admin@fixly.bo";
    private static final String CLAVE = "Fixly2026!";

    @Autowired
    private MockMvc mvc;

    @Test
    void resumen_cuenta_los_seeds_reales() throws Exception {
        String token = tokenAdmin();

        mvc.perform(get("/api/admin/resumen").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsuarios").value(7))
                .andExpect(jsonPath("$.clientes").value(3))
                .andExpect(jsonPath("$.tecnicos").value(3))
                .andExpect(jsonPath("$.administradores").value(1))
                .andExpect(jsonPath("$.tecnicosPendientes").value(0))
                .andExpect(jsonPath("$.tecnicosAprobados").value(3))
                .andExpect(jsonPath("$.categoriasActivas").value(3));
    }

    @Test
    void usuarios_lista_las_cuentas_con_perfil_y_nunca_el_hash() throws Exception {
        String token = tokenAdmin();

        MvcResult resultado = mvc.perform(get("/api/admin/usuarios").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        String cuerpo = resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(cuerpo).contains("Ferretería La Paz S.R.L.");
        assertThat(cuerpo).contains("admin@fixly.bo");
        assertThat(cuerpo).contains("empresa");
        assertThat(cuerpo).doesNotContain("passwordHash").doesNotContain("$2a$");
    }

    @Test
    void categorias_trae_tarifa_y_comision_juntas() throws Exception {
        String token = tokenAdmin();

        MvcResult resultado = mvc.perform(get("/api/admin/categorias").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        String cuerpo = resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
        Object cantidad = JsonPath.read(cuerpo, "$.length()");
        assertThat(cantidad).isEqualTo(3);

        List<Map<String, Object>> filas = JsonPath.read(cuerpo, "$");
        Map<String, Object> plomeria = filas.get(0);
        assertThat(plomeria.get("nombre")).isEqualTo("Plomería");
        assertThat(new BigDecimal(String.valueOf(plomeria.get("tarifaVisita"))))
                .isEqualByComparingTo("50.00");
        assertThat(new BigDecimal(String.valueOf(plomeria.get("tarifaHora"))))
                .isEqualByComparingTo("60.00");
        assertThat(new BigDecimal(String.valueOf(plomeria.get("comisionPct"))))
                .isEqualByComparingTo("15.00");
    }

    @Test
    void tecnicosPendientes_vacio_con_los_seeds_aprobados() throws Exception {
        String token = tokenAdmin();

        mvc.perform(get("/api/admin/tecnicos/pendientes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void un_tecnico_no_entra_al_backoffice() throws Exception {
        String token = JsonPath.read(
                cuerpo(login("diego.vargas@ejemplo.bo")), "$.token");

        mvc.perform(get("/api/admin/resumen").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("PERMISO_INSUFICIENTE"));
    }

    @Test
    void sin_token_responde_401() throws Exception {
        mvc.perform(get("/api/admin/usuarios"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    private String tokenAdmin() throws Exception {
        return JsonPath.read(cuerpo(login(EMAIL_ADMIN)), "$.token");
    }

    private MvcResult login(String email) throws Exception {
        return mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + CLAVE + "\"}"))
                .andReturn();
    }

    private String cuerpo(MvcResult resultado) throws Exception {
        return resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }
}

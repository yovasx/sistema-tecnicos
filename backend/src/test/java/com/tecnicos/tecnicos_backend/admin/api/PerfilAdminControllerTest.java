package com.tecnicos.tecnicos_backend.admin.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PerfilAdminControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entidades;

    @Test void perfil_es_el_del_actor_y_no_se_cachea() throws Exception {
        mvc.perform(get("/api/admin/perfil").header("Authorization", "Bearer " + login("admin@fixly.bo")))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.email").value("admin@fixly.bo"))
            .andExpect(jsonPath("$.rol").value("administrador"))
            .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test void actualiza_solo_el_perfil_propio_con_auditoria_y_me_fresco() throws Exception {
        String token = login("admin@fixly.bo");
        long id = adminId(), revision = revision();
        String cliente = jdbc.queryForObject("SELECT nombre FROM identity.usuarios WHERE email='maria.quispe@ejemplo.bo'", String.class);
        mvc.perform(put("/api/admin/perfil").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(datos(revision)))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.id").value(id)).andExpect(jsonPath("$.nombre").value("Andrea"))
            .andExpect(jsonPath("$.email").value("admin@fixly.bo"))
            .andExpect(jsonPath("$.rol").value("administrador"));
        // MockMvc comparte aquí la transacción del test; una petición real tiene
        // otro contexto JPA. Limpiar evita reutilizar la entidad leída en login.
        entidades.clear();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nombre").value("Andrea Rojas"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_svc.auditoria_usuarios WHERE usuario_id=? AND admin_id=? AND accion='editar'",
            Integer.class, id, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT nombre FROM identity.usuarios WHERE email='maria.quispe@ejemplo.bo'", String.class)).isEqualTo(cliente);
    }

    @Test void revision_obsoleta_responde_conflicto() throws Exception {
        String token = login("admin@fixly.bo");
        long previa = revision();
        jdbc.update("UPDATE identity.usuarios SET telefono='77770000' WHERE id=?", adminId());
        mvc.perform(put("/api/admin/perfil").header("Authorization", "Bearer " + token)
            .contentType("application/json").content(datos(previa))).andExpect(status().isConflict());
    }

    @Test void no_admin_y_anonimos_no_acceden_ni_escriben() throws Exception {
        mvc.perform(get("/api/admin/perfil")).andExpect(status().isUnauthorized());
        for (String email : new String[]{"maria.quispe@ejemplo.bo", "diego.vargas@ejemplo.bo"}) {
            String token = login(email);
            mvc.perform(get("/api/admin/perfil").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
            mvc.perform(put("/api/admin/perfil").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(datos(0))).andExpect(status().isForbidden());
        }
    }

    @Test void motivo_y_campos_invalidos_no_se_guardan() throws Exception {
        mvc.perform(put("/api/admin/perfil").header("Authorization", "Bearer " + login("admin@fixly.bo"))
            .contentType("application/json").content(datos(revision()).replace("Actualización del perfil", "x")))
            .andExpect(status().isBadRequest());
    }
    private long adminId() { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email='admin@fixly.bo'", Long.class); }
    private long revision() { return jdbc.queryForObject("SELECT revision_admin FROM identity.usuarios WHERE id=?", Long.class, adminId()); }
    private String datos(long revision) {
        return "{\"revision\":" + revision + ",\"nombre\":\"Andrea\",\"apellido\":\"Rojas\",\"telefono\":\"77771111\",\"motivo\":\"Actualización del perfil\"}";
    }
    private String login(String email) throws Exception {
        var r = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\"" + email + "\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.token");
    }
}

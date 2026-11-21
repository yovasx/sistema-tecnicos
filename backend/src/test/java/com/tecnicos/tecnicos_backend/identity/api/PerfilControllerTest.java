package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PerfilControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager entidades;
    static final String CLIENTE="maria.quispe@ejemplo.bo";
    String login(String email) throws Exception {
        return leer(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}"))
            .andExpect(status().isOk()).andReturn(),"$.token");
    }
    <T> T leer(MvcResult r,String ruta) throws Exception {
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),ruta);
    }
    long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    long revision(String email) { return jdbc.queryForObject("SELECT revision_admin FROM identity.usuarios WHERE email=?",Long.class,email); }
    String datos(String email) {
        return """
            {"revision":%d,"nombre":"Maria Nueva","apellido":"Quispe","telefono":"77771111",
             "razonSocial":"Empresa Actualizada","nit":"123456789"}
            """.formatted(revision(email));
    }
    ResultActions guardar(String token,String datos) throws Exception {
        return mvc.perform(put("/api/perfil").header("Authorization","Bearer "+token)
            .contentType("application/json").content(datos));
    }
    ResultActions password(String token,String actual,String nueva) throws Exception {
        return mvc.perform(post("/api/perfil/password").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"actual\":\""+actual+"\",\"nueva\":\""+nueva+"\"}"));
    }
    @Test void todos_los_roles_consultan_solo_su_perfil_sin_datos_sensibles() throws Exception {
        for (String email:new String[]{CLIENTE,"contacto@ferreteria-lapaz.bo","diego.vargas@ejemplo.bo","admin@fixly.bo"}) {
            mvc.perform(get("/api/perfil").header("Authorization","Bearer "+login(email)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.id").value(id(email))).andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.acceso").value("password"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist()).andExpect(jsonPath("$.ci").doesNotExist())
                .andExpect(jsonPath("$.especialidades").isArray());
        }
    }
    @Test void anonimo_no_consulta_ni_escribe() throws Exception {
        mvc.perform(get("/api/perfil")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/perfil").contentType("application/json").content(datos(CLIENTE))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/perfil/password").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
    }
    @Test void edita_solo_actor_audita_y_refresca_me_sin_cambiar_identidad() throws Exception {
        String token=login(CLIENTE);
        long admin=id("admin@fixly.bo");
        String nombreAdmin=jdbc.queryForObject("SELECT nombre FROM identity.usuarios WHERE id=?",String.class,admin);
        guardar(token,datos(CLIENTE)).andExpect(status().isOk())
            .andExpect(jsonPath("$.nombre").value("Maria Nueva")).andExpect(jsonPath("$.email").value(CLIENTE))
            .andExpect(jsonPath("$.rol").value("cliente")).andExpect(jsonPath("$.nit").isEmpty());
        entidades.clear();
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nombre").value("Maria Nueva Quispe"));
        assertThat(jdbc.queryForObject("SELECT nombre FROM identity.usuarios WHERE id=?",String.class,admin)).isEqualTo(nombreAdmin);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.auditoria_perfil WHERE usuario_id=? AND accion='editar'",
            Integer.class,id(CLIENTE))).isEqualTo(1);
        mvc.perform(get("/api/perfil/"+admin).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
    }
    @Test void detecta_cambio_concurrente_incluso_desde_administracion() throws Exception {
        String token=login(CLIENTE),previa=datos(CLIENTE);
        jdbc.update("UPDATE identity.usuarios SET telefono='77772222' WHERE id=?",id(CLIENTE));
        guardar(token,previa).andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("CAMBIO_CONCURRENTE"));
    }
    @Test void valida_empresa_y_conserva_perfil() throws Exception {
        String email="contacto@ferreteria-lapaz.bo",token=login(email);
        guardar(token,datos(email)).andExpect(status().isOk())
            .andExpect(jsonPath("$.tipoCliente").value("empresa"))
            .andExpect(jsonPath("$.razonSocial").value("Empresa Actualizada"));
    }
    @Test void no_acepta_empresa_sin_nit_valido() throws Exception {
        String email="contacto@ferreteria-lapaz.bo";
        guardar(login(email),datos(email).replace("123456789","xx")).andExpect(status().isUnprocessableContent());
    }
    @Test void no_cambia_identidad_tecnica_aprobada() throws Exception {
        String email="diego.vargas@ejemplo.bo";
        guardar(login(email),datos(email)).andExpect(status().isUnprocessableContent());
    }
    @Test void tecnico_actualiza_contacto_sin_tocar_aprobacion_ni_especialidades() throws Exception {
        String email="diego.vargas@ejemplo.bo",token=login(email);
        var perfil=mvc.perform(get("/api/perfil").header("Authorization","Bearer "+token)).andReturn();
        String nombre=leer(perfil,"$.nombre"),apellido=leer(perfil,"$.apellido");
        guardar(token,datos(email).replace("Maria Nueva",nombre).replace("Quispe",apellido))
            .andExpect(status().isOk()).andExpect(jsonPath("$.telefono").value("77771111"))
            .andExpect(jsonPath("$.estadoValidacion").value("aprobado"));
        assertThat((Object)leer(mvc.perform(get("/api/perfil").header("Authorization","Bearer "+token)).andReturn(),
            "$.especialidades")).isEqualTo(leer(perfil,"$.especialidades"));
    }
    @Test void misma_password_o_exceso_utf8_no_se_guarda() throws Exception {
        String token=login(CLIENTE);
        password(token,"Fixly2026!","Fixly2026!").andExpect(status().isBadRequest());
        password(token,"Fixly2026!","ñ".repeat(40)).andExpect(status().isBadRequest());
        password(token,"ñ".repeat(40),"NuevaClave2026!").andExpect(status().isBadRequest());
        mvc.perform(get("/api/perfil").header("Authorization","Bearer "+token)).andExpect(status().isOk());
    }
    @Test void datos_invalidos_no_escriben() throws Exception {
        guardar(login(CLIENTE),datos(CLIENTE).replace("Maria Nueva","")).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.auditoria_perfil WHERE usuario_id=?",Integer.class,id(CLIENTE))).isZero();
    }
    @Test void admin_no_elude_el_motivo_del_perfil_administrativo() throws Exception {
        String email="admin@fixly.bo";
        guardar(login(email),datos(email)).andExpect(status().isForbidden());
    }
    @Test void password_incorrecta_no_revoca_sesion() throws Exception {
        String token=login(CLIENTE);
        password(token,"incorrecta","NuevaClave2026!").andExpect(status().isBadRequest());
        mvc.perform(get("/api/perfil").header("Authorization","Bearer "+token)).andExpect(status().isOk());
    }
    @Test void cambia_password_revoca_todos_los_tokens_y_audita_sin_secretos() throws Exception {
        String token=login(CLIENTE),otro=login(CLIENTE);
        password(token,"Fixly2026!","NuevaClave2026!").andExpect(status().isNoContent());
        entidades.clear();
        for (String t:new String[]{token,otro}) {
            mvc.perform(get("/api/perfil").header("Authorization","Bearer "+t)).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+CLIENTE+"\",\"password\":\"NuevaClave2026!\"}")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT antes::text||despues::text FROM identity.auditoria_perfil WHERE usuario_id=? AND accion='password'",
            String.class,id(CLIENTE))).isEqualTo("{}{}");
    }
    @Test void google_no_adquiere_password_local() throws Exception {
        long id=id(CLIENTE);
        jdbc.update("INSERT INTO identity.identidades_google(sujeto,usuario_id) VALUES(?,?)","perfil-test",id);
        String token=login(CLIENTE);
        jdbc.update("UPDATE identity.usuarios SET password_hash=NULL WHERE id=?",id);
        entidades.clear();
        mvc.perform(get("/api/perfil").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.acceso").value("google"));
        password(token,"Fixly2026!","NuevaClave2026!").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.codigo").value("SIN_PASSWORD_LOCAL"));
        assertThat(jdbc.queryForObject("SELECT password_hash FROM identity.usuarios WHERE id=?",String.class,id)).isNull();
    }
}

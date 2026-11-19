package com.tecnicos.tecnicos_backend.admin.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
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
class UsuariosAdminControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test void filtros_y_paginacion_son_reales() throws Exception {
        String token=login("admin@fixly.bo");
        mvc.perform(get("/api/admin/usuarios/pagina").param("perfil","empresa").param("tamano","1").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.elementos.length()").value(1))
            .andExpect(jsonPath("$.elementos[0].tipoCliente").value("empresa"));
        mvc.perform(get("/api/admin/usuarios/pagina").param("rol","tecnico").param("busqueda","diego.vargas@ejemplo.bo").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.elementos[0].rol").value("tecnico"));
        mvc.perform(get("/api/admin/usuarios/pagina").param("pagina","-1").header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/usuarios/pagina").param("pagina","no-numero").header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest());
    }
    @Test void detalle_no_filtra_credenciales_ni_documentos() throws Exception {
        String token=login("admin@fixly.bo");
        var r=mvc.perform(get("/api/admin/usuarios/"+id("diego.vargas@ejemplo.bo")).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estadoValidacion").value("aprobado")).andReturn();
        assertThat(texto(r)).doesNotContain("password_hash","passwordHash","codigo_hash","ci_frente","certificacionesUrl");
    }
    @Test void editar_es_auditado_y_no_permite_cambiar_rol_o_email() throws Exception {
        String token=login("admin@fixly.bo"); long id=id("maria.quispe@ejemplo.bo"); long revision=revision(id);
        mvc.perform(put("/api/admin/usuarios/"+id).header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(datos(revision,"María Actualizada")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nombre").value("María Actualizada"))
            .andExpect(jsonPath("$.rol").value("cliente")).andExpect(jsonPath("$.email").value("maria.quispe@ejemplo.bo"));
        var r=mvc.perform(get("/api/admin/usuarios/"+id+"/historial").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].accion").value("editar"))
            .andExpect(jsonPath("$[0].despues.nombre").value("María Actualizada")).andReturn();
        assertThat(texto(r)).doesNotContain("password_hash","version_sesion");
        assertThat(revision(id)).isGreaterThan(revision);
    }
    @Test void conflicto_impide_sobrescribir_un_cambio() throws Exception {
        String token=login("admin@fixly.bo"); long id=id("maria.quispe@ejemplo.bo"); long rev=revision(id);
        jdbc.update("UPDATE identity.usuarios SET telefono='71234567' WHERE id=?",id);
        mvc.perform(put("/api/admin/usuarios/"+id).header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(datos(rev,"No guardar")))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("CAMBIO_CONCURRENTE"));
    }
    @Test void desactivar_revoca_y_reactivar_no_recupera_tokens_antiguos() throws Exception {
        String admin=login("admin@fixly.bo"), anterior=login("maria.quispe@ejemplo.bo");
        long id=id("maria.quispe@ejemplo.bo");
        estado(admin,id,false).andExpect(status().isOk()).andExpect(jsonPath("$.activo").value(false));
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+anterior)).andExpect(status().isUnauthorized());
        estado(admin,id,true).andExpect(status().isOk()).andExpect(jsonPath("$.activo").value(true));
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+anterior)).andExpect(status().isUnauthorized());
        assertThat(login("maria.quispe@ejemplo.bo")).isNotBlank();
    }
    @Test void no_se_desactiva_el_propio_administrador() throws Exception {
        estado(login("admin@fixly.bo"),id("admin@fixly.bo"),false)
            .andExpect(status().isUnprocessableContent());
    }
    @Test void identidad_tecnica_aprobada_no_se_cambia() throws Exception {
        long id=id("diego.vargas@ejemplo.bo"); String token=login("admin@fixly.bo");
        mvc.perform(put("/api/admin/usuarios/"+id).header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(datos(revision(id),"Otro nombre")))
            .andExpect(status().isUnprocessableContent());
    }
    @Test void no_admin_ni_anonimo_gestionan_cuentas() throws Exception {
        long id=id("maria.quispe@ejemplo.bo");
        mvc.perform(get("/api/admin/usuarios/pagina")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/usuarios/"+id).header("Authorization","Bearer "+login("diego.vargas@ejemplo.bo")))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/admin/usuarios/"+id).header("Authorization","Bearer "+login("maria.quispe@ejemplo.bo"))
            .contentType(MediaType.APPLICATION_JSON).content(datos(revision(id),"Intrusión")))
            .andExpect(status().isForbidden());
    }
    @Test void datos_invalidos_no_se_guardan() throws Exception {
        long id=id("maria.quispe@ejemplo.bo");
        mvc.perform(put("/api/admin/usuarios/"+id).header("Authorization","Bearer "+login("admin@fixly.bo"))
            .contentType(MediaType.APPLICATION_JSON).content(datos(revision(id),"A")))
            .andExpect(status().isBadRequest());
    }
    @Test void usuario_inexistente_es_404() throws Exception {
        mvc.perform(get("/api/admin/usuarios/922337").header("Authorization","Bearer "+login("admin@fixly.bo")))
            .andExpect(status().isNotFound());
    }
    private ResultActions estado(String token,long id,boolean activo) throws Exception {
        return mvc.perform(patch("/api/admin/usuarios/"+id+"/estado").header("Authorization","Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"revision\":"+revision(id)+",\"activo\":"+activo+",\"motivo\":\"Prueba de cambio administrativo\"}"));
    }
    private String datos(long revision,String nombre) {
        return """
            {"revision":%d,"nombre":"%s","apellido":"Quispe","telefono":"71234567",
             "motivo":"Actualización solicitada por el usuario","rol":"administrador","email":"no-cambiar@prueba.bo"}
            """.formatted(revision,nombre);
    }
    private long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    private long revision(long id) { return jdbc.queryForObject("SELECT revision_admin FROM identity.usuarios WHERE id=?",Long.class,id); }
    private String login(String email) throws Exception {
        return JsonPath.read(texto(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn()),"$.token");
    }
    private String texto(MvcResult r) throws Exception { return r.getResponse().getContentAsString(StandardCharsets.UTF_8); }
}

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
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TecnicosAdminControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Test void directorio_paginado_incluye_aprobados_anteriores_sin_datos_privados() throws Exception {
        String token=admin();
        var r=mvc.perform(get("/api/admin/tecnicos").param("busqueda","diego.vargas@ejemplo.bo")
            .header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.elementos[0].expedienteRequerido").value(false))
            .andExpect(jsonPath("$.elementos[0].especialidades.length()").value(2)).andReturn();
        assertThat(texto(r)).doesNotContain("\"ci\"", "fechaNacimiento", "ciFrenteUrl", "certificacionesUrl","password");
    }
    @Test void filtros_de_especialidad_no_duplican_tecnicos() throws Exception {
        int categoria=jdbc.queryForObject("SELECT id FROM orders.categorias_servicio WHERE nombre='Plomería'",Integer.class);
        mvc.perform(get("/api/admin/tecnicos").param("busqueda","diego.vargas@ejemplo.bo")
                .param("categoria",String.valueOf(categoria)).param("expediente","aprobado")
                .param("cuenta","activo").param("tamano","1").header("Authorization","Bearer "+admin()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.elementos.length()").value(1));
    }
    @Test void borradores_aparecen_en_directorio_pero_no_en_cola_de_revision() throws Exception {
        String email="directorio-"+UUID.randomUUID()+"@prueba.bo";
        var alta=mvc.perform(post("/api/tecnicos/registro").contentType(MediaType.APPLICATION_JSON).content("""
            {"nombre":"Rosa","apellido":"Directorio","email":"%s","password":"ClaveSegura2026!"}
            """.formatted(email))).andExpect(status().isCreated()).andReturn();
        Number id=JsonPath.read(texto(alta),"$.usuario.id");
        String token=admin();
        mvc.perform(get("/api/admin/tecnicos").param("busqueda",email).param("expediente","borrador")
            .header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.elementos[0].estadoValidacion").value("pendiente"));
        mvc.perform(get("/api/admin/tecnicos/"+id).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.expediente.estadoExpediente").value("borrador"));
    }
    @Test void admin_consulta_cuenta_inactiva_y_reactivacion_no_cambia_aprobacion() throws Exception {
        long id=id("diego.vargas@ejemplo.bo"); String token=admin();
        estado(token,id,false).andExpect(status().isOk());
        mvc.perform(get("/api/admin/tecnicos/"+id).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.cuenta.activo").value(false))
            .andExpect(jsonPath("$.cuenta.estadoValidacion").value("aprobado"));
        mvc.perform(get("/api/admin/tecnicos/expedientes/"+id).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estadoExpediente").value("aprobado"));
        estado(token,id,true).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT estado_validacion::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,id))
            .isEqualTo("aprobado");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.revisiones_tecnico WHERE tecnico_id=?",Integer.class,id)).isZero();
    }
    @Test void historial_no_inventa_revisiones_para_aprobaciones_previas() throws Exception {
        mvc.perform(get("/api/admin/tecnicos/"+id("diego.vargas@ejemplo.bo")+"/revisiones").header("Authorization","Bearer "+admin()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void parametros_invalidos_son_400() throws Exception {
        String token=admin();
        for(String filtro:new String[]{"expediente","cuenta","disponibilidad"})
            mvc.perform(get("/api/admin/tecnicos").param(filtro,"invalido").header("Authorization","Bearer "+token))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/tecnicos").param("tamano","101").header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/tecnicos").param("categoria","-1").header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest());
    }
    @Test void cliente_y_tecnico_no_entran_en_directorio_detalle_ni_historial() throws Exception {
        long id=id("diego.vargas@ejemplo.bo");
        mvc.perform(get("/api/admin/tecnicos")).andExpect(status().isUnauthorized());
        for(String email:new String[]{"maria.quispe@ejemplo.bo","diego.vargas@ejemplo.bo"}) {
            String token=login(email);
            for(String ruta:new String[]{"/api/admin/tecnicos","/api/admin/tecnicos/"+id,"/api/admin/tecnicos/"+id+"/revisiones"})
                mvc.perform(get(ruta).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        }
    }
    @Test void no_se_lee_un_cliente_como_tecnico() throws Exception {
        String token=admin(); long id=id("maria.quispe@ejemplo.bo");
        mvc.perform(get("/api/admin/tecnicos/"+id).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/tecnicos/"+id+"/revisiones").header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
    }
    private ResultActions estado(String token,long id,boolean activo) throws Exception {
        long revision=jdbc.queryForObject("SELECT revision_admin FROM identity.usuarios WHERE id=?",Long.class,id);
        return mvc.perform(patch("/api/admin/usuarios/"+id+"/estado").header("Authorization","Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"revision\":"+revision+",\"activo\":"+activo+",\"motivo\":\"Prueba de gestión técnica\"}"));
    }
    private long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    private String admin() throws Exception { return login("admin@fixly.bo"); }
    private String login(String email) throws Exception {
        var r=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn();
        return JsonPath.read(texto(r),"$.token");
    }
    private String texto(MvcResult r) throws Exception { return r.getResponse().getContentAsString(StandardCharsets.UTF_8); }
}

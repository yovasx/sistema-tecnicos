package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DireccionesControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    static final String CLIENTE="maria.quispe@ejemplo.bo";
    static final String OTRO="jorge.mamani@ejemplo.bo";

    String login(String email) throws Exception {
        var r=mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}"))
            .andExpect(status().isOk()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),"$.token");
    }

    String cuerpo(String etiqueta,String referencia,boolean predeterminada) {
        return """
            {"etiqueta":"%s","referencia":"%s","latitud":-16.5000,"longitud":-68.1300,
             "predeterminada":%s}
            """.formatted(etiqueta,referencia,predeterminada);
    }

    ResultActions crear(String token,String cuerpo) throws Exception {
        return mvc.perform(post("/api/perfil/direcciones").header("Authorization","Bearer "+token)
            .contentType("application/json").content(cuerpo));
    }

    long crearId(String token,String cuerpo) throws Exception {
        MvcResult r=crear(token,cuerpo).andExpect(status().isCreated()).andReturn();
        return ((Number)JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),"$.id")).longValue();
    }

    @Test void crea_lista_edita_y_quita_con_baja_logica() throws Exception {
        String token=login(CLIENTE);
        MvcResult creada=crear(token,cuerpo("Casa","Av. Arce 1234, Sopocachi",false))
            .andExpect(status().isCreated()).andReturn();
        String json=creada.getResponse().getContentAsString(StandardCharsets.UTF_8);
        long id=((Number)JsonPath.read(json,"$.id")).longValue();
        // La primera dirección siempre queda como predeterminada.
        assertThat((Boolean)JsonPath.read(json,"$.predeterminada")).isTrue();
        mvc.perform(get("/api/perfil/direcciones").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$[0].id").value(id))
            .andExpect(jsonPath("$[0].referencia").value("Av. Arce 1234, Sopocachi"));
        mvc.perform(put("/api/perfil/direcciones/"+id).header("Authorization","Bearer "+token)
            .contentType("application/json").content(cuerpo("Oficina","Calle 21 de Calacoto 456",true)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.etiqueta").value("Oficina"));
        mvc.perform(delete("/api/perfil/direcciones/"+id).header("Authorization","Bearer "+token))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/perfil/direcciones").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        assertThat(jdbc.queryForObject("SELECT activa FROM identity.direcciones_cliente WHERE id=?",
            Boolean.class,id)).isFalse();
    }

    @Test void una_sola_predeterminada_por_cliente() throws Exception {
        String token=login(CLIENTE);
        long primera=crearId(token,cuerpo("Casa","Av. Arce 1234, Sopocachi",false));
        crearId(token,cuerpo("Oficina","Calle 21 de Calacoto 456",true));
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM identity.direcciones_cliente
            WHERE usuario_id=(SELECT id FROM identity.usuarios WHERE email=?) AND predeterminada AND activa
            """,Integer.class,CLIENTE)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT predeterminada FROM identity.direcciones_cliente WHERE id=?",
            Boolean.class,primera)).isFalse();
    }

    @Test void no_edita_ni_quita_direcciones_de_otro_cliente() throws Exception {
        long id=crearId(login(CLIENTE),cuerpo("Casa","Av. Arce 1234, Sopocachi",false));
        String intruso=login(OTRO);
        mvc.perform(put("/api/perfil/direcciones/"+id).header("Authorization","Bearer "+intruso)
            .contentType("application/json").content(cuerpo("Robada","Calle Falsa 123",true)))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.codigo").value("DIRECCION_NO_ENCONTRADA"));
        mvc.perform(delete("/api/perfil/direcciones/"+id).header("Authorization","Bearer "+intruso))
            .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT activa FROM identity.direcciones_cliente WHERE id=?",
            Boolean.class,id)).isTrue();
    }

    @Test void limita_a_diez_direcciones_activas() throws Exception {
        String token=login(CLIENTE);
        for (int i=1;i<=10;i++) {
            crearId(token,cuerpo("Lugar "+i,"Referencia numero "+i+" de prueba",false));
        }
        crear(token,cuerpo("Extra","Referencia numero once de prueba",false))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("LIMITE_DIRECCIONES"));
    }

    @Test void valida_campos_en_espanol() throws Exception {
        crear(login(CLIENTE),cuerpo("Casa","abc",false))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.campos[0].mensaje").value("La dirección debe tener entre 5 y 300 caracteres."));
    }

    @Test void anonimo_no_accede() throws Exception {
        mvc.perform(get("/api/perfil/direcciones")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/perfil/direcciones").contentType("application/json")
            .content(cuerpo("Casa","Av. Arce 1234",false))).andExpect(status().isUnauthorized());
    }
}

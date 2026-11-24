package com.tecnicos.tecnicos_backend.reputation.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReputacionControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    static final String CLIENTE="maria.quispe@ejemplo.bo";
    static final String TECNICO="diego.vargas@ejemplo.bo";
    static final String OTRO="jorge.mamani@ejemplo.bo";

    String login(String email) throws Exception {
        var r=mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}"))
            .andExpect(status().isOk()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),"$.token");
    }

    long id(String email) {
        return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email);
    }

    /** Orden directa: la asignación y la reparación todavía no tienen flujo propio. */
    long orden(long cliente,long tecnico,String estado) {
        int categoria=jdbc.queryForObject(
            "SELECT id FROM orders.categorias_servicio WHERE activa ORDER BY id LIMIT 1",Integer.class);
        return jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,tecnico_id,categoria_id,descripcion_falla,
                ubicacion_cliente,direccion_referencia,estado,asignado_en,finalizado_en)
            VALUES(?,?,?,'Falla de prueba para calificar',
                ST_SetSRID(ST_MakePoint(-68.13,-16.5),4326)::geography,
                'Av. Arce 1234, Sopocachi',?::orders.estado_orden,now(),
                CASE WHEN ?='finalizado' THEN now() END)
            RETURNING id
            """,Long.class,cliente,tecnico,categoria,estado,estado);
    }

    ResultActions calificar(String token,long orden,int puntaje,String comentario) throws Exception {
        return mvc.perform(post("/api/ordenes/"+orden+"/calificacion")
            .header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"puntaje\":"+puntaje+",\"comentario\":\""+comentario+"\"}"));
    }

    @Test void el_cliente_califica_al_tecnico_y_se_ve_en_su_resumen() throws Exception {
        long orden=orden(id(CLIENTE),id(TECNICO),"finalizado");
        String token=login(CLIENTE);
        calificar(token,orden,5,"Llegó a tiempo y resolvió todo.")
            .andExpect(status().isCreated()).andExpect(jsonPath("$.puntaje").value(5));
        mvc.perform(get("/api/perfil/reputacion").header("Authorization","Bearer "+login(TECNICO)))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.promedio").isNumber())
            .andExpect(jsonPath("$.total").isNumber())
            .andExpect(jsonPath("$.ordenesFinalizadas").isNumber())
            .andExpect(jsonPath("$.recibidas[0].comentario").value("Llegó a tiempo y resolvió todo."))
            .andExpect(jsonPath("$.recibidas[0].categoria").isNotEmpty());
        // El detalle le dice al cliente que ya calificó esa orden.
        mvc.perform(get("/api/ordenes/"+orden).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.miCalificacion").value(5));
    }

    @Test void el_tecnico_califica_al_cliente() throws Exception {
        long orden=orden(id(CLIENTE),id(TECNICO),"finalizado");
        mvc.perform(post("/api/tecnicos/ordenes/"+orden+"/calificacion")
                .header("Authorization","Bearer "+login(TECNICO)).contentType("application/json")
                .content("{\"puntaje\":4,\"comentario\":\"Dirección correcta.\"}"))
            .andExpect(status().isCreated());
        mvc.perform(get("/api/perfil/reputacion").header("Authorization","Bearer "+login(CLIENTE)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.promedio").isNumber())
            .andExpect(jsonPath("$.total").isNumber())
            .andExpect(jsonPath("$.recibidas[0].comentario").value("Dirección correcta."));
    }

    @Test void una_sola_calificacion_por_orden_y_calificador() throws Exception {
        long orden=orden(id(CLIENTE),id(TECNICO),"finalizado");
        String token=login(CLIENTE);
        calificar(token,orden,5,"Primera").andExpect(status().isCreated());
        calificar(token,orden,1,"Segunda").andExpect(status().isConflict());
    }

    @Test void no_califica_ordenes_que_no_estan_finalizadas() throws Exception {
        long orden=orden(id(CLIENTE),id(TECNICO),"en_camino");
        calificar(login(CLIENTE),orden,5,"Todavía no")
            .andExpect(status().isUnprocessableContent())
            .andExpect(jsonPath("$.codigo").value("CALIFICACION_NO_PERMITIDA"));
    }

    @Test void no_califica_ordenes_ajenas() throws Exception {
        long orden=orden(id(CLIENTE),id(TECNICO),"finalizado");
        calificar(login(OTRO),orden,5,"No es mi orden").andExpect(status().isForbidden());
    }

    @Test void valida_la_puntuacion() throws Exception {
        long orden=orden(id(CLIENTE),id(TECNICO),"finalizado");
        calificar(login(CLIENTE),orden,6,"Fuera de rango").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.campos[0].mensaje").value("La puntuación debe estar entre 1 y 5."));
    }

    @Test void anonimo_no_califica_ni_consulta() throws Exception {
        long orden=orden(id(CLIENTE),id(TECNICO),"finalizado");
        mvc.perform(post("/api/ordenes/"+orden+"/calificacion").contentType("application/json")
            .content("{\"puntaje\":5}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/perfil/reputacion")).andExpect(status().isUnauthorized());
    }
}

package com.tecnicos.tecnicos_backend.geo.api;

import com.tecnicos.tecnicos_backend.geo.application.SeguimientoService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SeguimientoControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired SeguimientoService servicio;
    static final String CLIENTE="maria.quispe@ejemplo.bo",TECNICO="diego.vargas@ejemplo.bo";
    long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    String login(String email) throws Exception {
        var r=mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),"$.token");
    }
    long orden() {
        return jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,tecnico_id,categoria_id,
                descripcion_falla,ubicacion_cliente,direccion_referencia,estado)
            VALUES(?,?,(SELECT min(id) FROM orders.categorias_servicio WHERE activa),
                'Falla de prueba de seguimiento',ST_SetSRID(ST_MakePoint(-68.13,-16.5),4326)::geography,
                'Av. Arce 1234','en_camino') RETURNING id
            """,Long.class,id(CLIENTE),id(TECNICO));
    }
    String ticket(long orden) throws Exception {
        var r=mvc.perform(post("/api/ordenes/"+orden+"/seguimiento/ticket")
            .header("Authorization","Bearer "+login(CLIENTE))).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store")).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),"$.ticket");
    }
    @Test void solo_duenio_consulta_y_no_hay_posiciones_inventadas() throws Exception {
        long orden=orden();
        mvc.perform(get("/api/ordenes/"+orden+"/seguimiento").header("Authorization","Bearer "+login(CLIENTE)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.posicion").isEmpty())
            .andExpect(jsonPath("$.etaMinutos").isEmpty());
        mvc.perform(get("/api/ordenes/"+orden+"/seguimiento").header("Authorization","Bearer "+login("jorge.mamani@ejemplo.bo")))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/ordenes/"+orden+"/seguimiento/ticket")).andExpect(status().isUnauthorized());
    }
    @Test void ticket_se_guarda_hasheado_y_se_consume_una_sola_vez() throws Exception {
        long orden=orden(); String permiso=ticket(orden);
        String hash=jdbc.queryForObject("SELECT hash FROM identity.tickets_seguimiento WHERE orden_id=?",String.class,orden);
        assertThat(hash).isNotEqualTo(permiso).hasSize(64);
        var acceso=servicio.consumir(permiso);
        assertThat(acceso.usuario()).isEqualTo(id(CLIENTE));
        assertThat(acceso.orden()).isEqualTo(orden);
        assertThatThrownBy(()->servicio.consumir(permiso)).hasMessage("El seguimiento no está disponible.");
    }
    @Test void permiso_expirado_no_autentica() throws Exception {
        long orden=orden(); String permiso=ticket(orden);
        jdbc.update("UPDATE identity.tickets_seguimiento SET expira_en=clock_timestamp()-interval '1 second' WHERE orden_id=?",orden);
        assertThatThrownBy(()->servicio.consumir(permiso)).hasMessage("El seguimiento no está disponible.");
    }
    @Test void cambiar_version_de_sesion_invalida_tambien_el_ticket_pendiente() throws Exception {
        long orden=orden(); String permiso=ticket(orden);
        jdbc.update("UPDATE identity.usuarios SET version_sesion=version_sesion+1 WHERE id=?",id(CLIENTE));
        assertThatThrownBy(()->servicio.consumir(permiso)).hasMessage("El seguimiento no está disponible.");
    }
    @Test void el_socket_revalida_revocacion_y_expiracion() throws Exception {
        long orden=orden(); var acceso=servicio.consumir(ticket(orden));
        assertThat(servicio.consultar(acceso).orden()).isEqualTo(orden);
        assertThatThrownBy(()->servicio.consultar(new SeguimientoService.Acceso(acceso.usuario(),
            acceso.orden(),acceso.version(),Instant.now().minusSeconds(1))))
            .hasMessage("El seguimiento no está disponible.");
        jdbc.update("UPDATE identity.usuarios SET version_sesion=version_sesion+1 WHERE id=?",id(CLIENTE));
        assertThatThrownBy(()->servicio.consultar(acceso)).hasMessage("El seguimiento no está disponible.");
    }
    @Test void reporte_tecnico_ligado_a_orden_y_lectura_solo_en_camino() throws Exception {
        long orden=orden();
        mvc.perform(post("/api/tecnicos/ubicacion").header("Authorization","Bearer "+login(TECNICO))
            .contentType("application/json").content("""
                {"orden":%d,"latitud":-16.501,"longitud":-68.131,"precision":12}
                """.formatted(orden))).andExpect(status().isNoContent());
        mvc.perform(get("/api/ordenes/"+orden+"/seguimiento").header("Authorization","Bearer "+login(CLIENTE)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.posicion.latitud").value(-16.501))
            .andExpect(jsonPath("$.vigente").value(true)).andExpect(jsonPath("$.etaMinutos").isNumber());
        jdbc.update("UPDATE orders.ordenes_servicio SET estado='en_diagnostico' WHERE id=?",orden);
        mvc.perform(get("/api/ordenes/"+orden+"/seguimiento").header("Authorization","Bearer "+login(CLIENTE)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.posicion").isEmpty())
            .andExpect(jsonPath("$.etaMinutos").isEmpty());
    }
    @Test void cliente_no_reporta_posiciones_y_otro_tecnico_no_reporta_orden_ajena() throws Exception {
        long orden=orden(); String cuerpo="{\"orden\":"+orden+",\"latitud\":-16.5,\"longitud\":-68.13}";
        mvc.perform(post("/api/tecnicos/ubicacion").header("Authorization","Bearer "+login(CLIENTE))
            .contentType("application/json").content(cuerpo)).andExpect(status().isForbidden());
        mvc.perform(post("/api/tecnicos/ubicacion").header("Authorization","Bearer "+login("lucia.fernandez@ejemplo.bo"))
            .contentType("application/json").content(cuerpo)).andExpect(status().isNotFound());
    }
}

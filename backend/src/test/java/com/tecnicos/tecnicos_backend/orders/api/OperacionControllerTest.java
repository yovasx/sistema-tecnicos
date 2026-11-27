package com.tecnicos.tecnicos_backend.orders.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Transactional
class OperacionControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    long tecnico() { return id("diego.vargas@ejemplo.bo"); }
    String token(String email) throws Exception {
        return leer(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn(),"$.token");
    }
    <T> T leer(MvcResult r,String ruta) throws Exception { return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),ruta); }
    ResultActions enviar(String ruta,String token,String cuerpo) throws Exception {
        return mvc.perform(post(ruta).header("Authorization","Bearer "+token).contentType("application/json").content(cuerpo));
    }
    long solicitud() {
        return jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,categoria_id,descripcion_falla,ubicacion_cliente,direccion_referencia)
            VALUES(?,(SELECT min(categoria_id) FROM identity.tecnico_especialidades WHERE tecnico_id=?),
                'Solicitud de integración operativa',
                (SELECT ST_PointOnSurface(poligono::geometry)::geography FROM geo.zonas_cobertura WHERE tecnico_id=? AND activo LIMIT 1),
                'Referencia privada de prueba') RETURNING id
            """,Long.class,id("maria.quispe@ejemplo.bo"),tecnico(),tecnico());
    }
    void disponible(String token) throws Exception {
        mvc.perform(put("/api/tecnicos/disponibilidad").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"disponible\":true}")).andExpect(status().isNoContent());
    }
    void llegada(long orden,String tecnico,String cliente) throws Exception {
        String codigo=leer(enviar("/api/servicios/"+orden+"/atencion/codigo",cliente,"{}")
            .andExpect(status().isOk()).andReturn(),"$.codigo");
        enviar("/api/servicios/"+orden+"/atencion/llegada",tecnico,"{\"codigo\":\""+codigo+"\"}")
            .andExpect(status().isNoContent());
    }
    @Test void flujo_real_aceptacion_gps_diagnostico_cotizacion_reparacion_finalizacion() throws Exception {
        long orden=solicitud(); String t=token("diego.vargas@ejemplo.bo"),c=token("maria.quispe@ejemplo.bo");
        disponible(t);
        mvc.perform(get("/api/tecnicos/panel").header("Authorization","Bearer "+t)).andExpect(status().isOk())
            .andExpect(jsonPath("$.solicitudes[0].referencia").doesNotExist())
            .andExpect(jsonPath("$.solicitudes[0].latitud").doesNotExist());
        enviar("/api/tecnicos/servicios/"+orden+"/aceptar",t,"{}").andExpect(status().isNoContent());
        enviar("/api/tecnicos/servicios/"+orden+"/aceptar",t,"{}").andExpect(status().isNoContent());
        String sesion=leer(enviar("/api/tecnicos/servicios/"+orden+"/gps",t,
            "{\"plataforma\":\"web\",\"segundoPlano\":false}").andExpect(status().isOk()).andReturn(),"$.sesion");
        enviar("/api/tecnicos/ubicacion",t,"""
            {"sesion":"%s","latitud":-16.5,"longitud":-68.13,"precision":5,"capturadoEn":"%s"}
            """.formatted(sesion,Instant.now())).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.ubicacion_actual WHERE orden_id=?",Long.class,orden)).isEqualTo(1);
        llegada(orden,t,c);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.ubicacion_actual WHERE orden_id=?",Long.class,orden)).isZero();
        String cot="""
            {"clave":"%s","motivo":"Diagnóstico comprobado","items":[
                {"tipo":"mano_obra","descripcion":"Reparación del equipo","cantidad":1,"precioUnitario":150}]}
            """.formatted(UUID.randomUUID());
        long cotizacion=((Number)leer(enviar("/api/tecnicos/servicios/"+orden+"/cotizaciones",t,cot)
            .andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        enviar("/api/tecnicos/servicios/"+orden+"/cotizaciones",t,cot).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(cotizacion));
        enviar("/api/ordenes/"+orden+"/cotizaciones/"+cotizacion+"/responder",c,"{\"acepta\":true}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("aceptada"));
        enviar("/api/tecnicos/servicios/"+orden+"/reparacion",t,"{}").andExpect(status().isNoContent());
        long revision=jdbc.queryForObject("SELECT revision FROM orders.atenciones WHERE orden_id=?",Long.class,orden);
        mvc.perform(multipart("/api/servicios/"+orden+"/atencion/entrega")
            .file(new org.springframework.mock.web.MockMultipartFile("evidencia","trabajo.pdf","application/pdf",
                "%PDF-1.4\nEvidencia de reparación".getBytes(StandardCharsets.UTF_8)))
            .param("revision",String.valueOf(revision)).param("trabajo","Se reparó el equipo y se comprobó su funcionamiento.")
            .header("Authorization","Bearer "+t)).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT estado::text FROM orders.ordenes_servicio WHERE id=?",String.class,orden)).isEqualTo("en_reparacion");
        revision=jdbc.queryForObject("SELECT revision FROM orders.atenciones WHERE orden_id=?",Long.class,orden);
        enviar("/api/servicios/"+orden+"/atencion/conformidad",c,
            "{\"revision\":"+revision+",\"conforme\":true,\"comentario\":\"El equipo funciona correctamente.\"}").andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT estado::text FROM orders.ordenes_servicio WHERE id=?",String.class,orden)).isEqualTo("finalizado");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM billing.pagos WHERE orden_id=?",Long.class,orden)).isZero();
    }
    @Test void no_inicia_reparacion_sin_cotizacion_aceptada() throws Exception {
        long o=solicitud(); String t=token("diego.vargas@ejemplo.bo"); disponible(t);
        enviar("/api/tecnicos/servicios/"+o+"/aceptar",t,"{}").andExpect(status().isNoContent());
        llegada(o,t,token("maria.quispe@ejemplo.bo"));
        enviar("/api/tecnicos/servicios/"+o+"/reparacion",t,"{}").andExpect(status().isConflict());
    }
    @Test void reintento_ofrece_a_otro_tecnico_tras_rechazo() {
        long diego=tecnico(), raul=id("raul.choque@ejemplo.bo");
        jdbc.update("""
            UPDATE geo.zonas_cobertura
            SET poligono=ST_GeomFromText(
                'POLYGON((-68.3 -16.3,-68.3 -16.7,-67.9 -16.7,-67.9 -16.3,-68.3 -16.3))',4326)::geography
            WHERE tecnico_id IN (?,?)
            """,diego,raul);
        long orden=jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,categoria_id,descripcion_falla,ubicacion_cliente,direccion_referencia)
            VALUES(?,(SELECT id FROM orders.categorias_servicio WHERE nombre='Plomería'),
                'Solicitud para probar reintento',
                ST_SetSRID(ST_MakePoint(-68.13,-16.51),4326)::geography,'Referencia de prueba')
            RETURNING id
            """,Long.class,id("maria.quispe@ejemplo.bo"));

        assertThat(jdbc.queryForObject("SELECT orders.generar_ofertas(?,1,2)",Integer.class,orden)).isEqualTo(1);
        long primero=jdbc.queryForObject("SELECT tecnico_id FROM orders.ofertas_orden WHERE orden_id=?",Long.class,orden);
        jdbc.update("""
            UPDATE orders.ofertas_orden SET estado='rechazada',motivo_rechazo='No disponible',
                respondida_en=clock_timestamp() WHERE orden_id=? AND tecnico_id=?
            """,orden,primero);

        assertThat(jdbc.queryForObject("SELECT orders.generar_ofertas(?,1,2)",Integer.class,orden)).isEqualTo(1);
        long segundo=jdbc.queryForObject("""
            SELECT tecnico_id FROM orders.ofertas_orden
            WHERE orden_id=? AND tecnico_id<>?
            """,Long.class,orden,primero);
        assertThat(segundo).isNotEqualTo(primero);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM orders.ofertas_orden WHERE orden_id=?",Integer.class,orden))
            .isEqualTo(2);
    }
    @Test void solo_cliente_duenio_cancela_antes_de_asignar() throws Exception {
        long o=solicitud(); String c=token("maria.quispe@ejemplo.bo");
        enviar("/api/ordenes/"+o+"/cancelar",c,"{\"motivo\":\"Ya no necesito el servicio\"}").andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT estado::text FROM orders.ordenes_servicio WHERE id=?",String.class,o)).isEqualTo("cancelado");
    }
    @Test void chat_idempotente_y_privado_despues_de_asignar() throws Exception {
        long o=solicitud(); String t=token("diego.vargas@ejemplo.bo"),c=token("maria.quispe@ejemplo.bo"); disponible(t);
        enviar("/api/tecnicos/servicios/"+o+"/aceptar",t,"{}").andExpect(status().isNoContent());
        String mensaje="{\"clave\":\""+UUID.randomUUID()+"\",\"contenido\":\"Estoy en camino\"}";
        long m=((Number)leer(enviar("/api/servicios/"+o+"/mensajes",t,mensaje).andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        enviar("/api/servicios/"+o+"/mensajes",t,mensaje).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(m));
        mvc.perform(get("/api/servicios/"+o+"/mensajes").header("Authorization","Bearer "+c)).andExpect(status().isOk())
            .andExpect(jsonPath("$.mensajes[-1].contenido").value("Estoy en camino"));
        mvc.perform(get("/api/servicios/"+o+"/mensajes").header("Authorization","Bearer "+token("jorge.mamani@ejemplo.bo")))
            .andExpect(status().isNotFound());
    }
    @Test void preferencias_tienen_revision_y_no_se_guardan_push_ficticios() throws Exception {
        String c=token("maria.quispe@ejemplo.bo");
        long rev=((Number)leer(mvc.perform(get("/api/perfil/preferencias").header("Authorization","Bearer "+c))
            .andExpect(status().isOk()).andReturn(),"$.revision")).longValue();
        mvc.perform(put("/api/perfil/preferencias").header("Authorization","Bearer "+c).contentType("application/json")
            .content("{\"revision\":"+rev+",\"permitirGps\":false}")).andExpect(status().isOk()).andExpect(jsonPath("$.permitirGps").value(false));
        mvc.perform(put("/api/perfil/preferencias").header("Authorization","Bearer "+c).contentType("application/json")
            .content("{\"revision\":"+rev+",\"permitirGps\":true}")).andExpect(status().isConflict());
    }
    @Test void notificaciones_de_otro_usuario_no_se_marcan_leidas() throws Exception {
        long n=jdbc.queryForObject("INSERT INTO notification.notificaciones(usuario_id,tipo,mensaje) VALUES(?,'sistema','Prueba') RETURNING id",
            Long.class,id("maria.quispe@ejemplo.bo"));
        mvc.perform(patch("/api/notificaciones/"+n+"/leer").header("Authorization","Bearer "+token("jorge.mamani@ejemplo.bo")))
            .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT leido FROM notification.notificaciones WHERE id=?",Boolean.class,n)).isFalse();
    }
}

package com.tecnicos.tecnicos_backend.orders.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Transactional
class AtencionLocalTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager tm;
    long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    long tecnico() { return id("diego.vargas@ejemplo.bo"); }
    long cliente() { return id("maria.quispe@ejemplo.bo"); }
    void actor(long id) { jdbc.queryForObject("SELECT set_config('app.usuario_id',?,true)",String.class,String.valueOf(id)); }
    long orden() {
        return jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,categoria_id,descripcion_falla,ubicacion_cliente,direccion_referencia)
            SELECT ?,min(e.categoria_id),'Atención local de prueba',
                (SELECT ST_PointOnSurface(poligono::geometry)::geography FROM geo.zonas_cobertura
                    WHERE tecnico_id=? AND activo LIMIT 1),'Dirección privada de prueba'
            FROM identity.tecnico_especialidades e WHERE e.tecnico_id=? RETURNING id
            """,Long.class,cliente(),tecnico(),tecnico());
    }
    long oferta(long orden) {
        return jdbc.queryForObject("INSERT INTO orders.ofertas_orden(orden_id,tecnico_id,expira_en) VALUES(?,?,clock_timestamp()+interval '2 minutes') RETURNING id",
            Long.class,orden,tecnico());
    }
    long asignada() {
        long o=orden(); actor(tecnico()); jdbc.queryForObject("SELECT orders.cambiar_disponibilidad(true)",String.class);
        assertThat(jdbc.queryForObject("SELECT orders.tomar_servicio(?)",Boolean.class,o)).isTrue(); return o;
    }
    long revision(long orden) { return jdbc.queryForObject("SELECT revision FROM orders.atenciones WHERE orden_id=?",Long.class,orden); }
    String token(String email) throws Exception {
        return leer(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn(),"$.token");
    }
    <T> T leer(MvcResult r,String ruta) throws Exception {
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),ruta);
    }
    ResultActions postJson(String ruta,String token,String body) throws Exception {
        return mvc.perform(post(ruta).header("Authorization","Bearer "+token).contentType("application/json").content(body));
    }
    @Test void alta_tecnica_publica_cerrada_en_modo_empresa() throws Exception {
        mvc.perform(post("/api/tecnicos/registro").contentType("application/json").content("""
            {"nombre":"Ana","apellido":"Prueba","email":"sin-invitacion@prueba.bo","password":"ClaveSegura2026!"}
            """)).andExpect(status().isForbidden()).andExpect(jsonPath("$.codigo").value("ALTA_POR_INVITACION"));
        mvc.perform(post("/api/auth/google/desafio").contentType("application/json").content("{\"proposito\":\"tecnico\"}"))
            .andExpect(status().isForbidden());
    }
    @Test void un_tecnico_no_puede_aceptar_dos_ofertas_y_reintentar_la_propia_es_idempotente() {
        long a=orden(),b=orden(),fa=oferta(a),fb=oferta(b); actor(tecnico());
        jdbc.queryForObject("SELECT orders.cambiar_disponibilidad(true)",String.class);
        assertThat(jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,fa,tecnico())).isTrue();
        assertThat(jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,fa,tecnico())).isTrue();
        assertThat(jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,fb,tecnico())).isFalse();
        assertThat(jdbc.queryForObject("SELECT tecnico_id FROM orders.ordenes_servicio WHERE id=?",Long.class,b)).isNull();
    }
    @Test void oferta_no_se_acepta_si_disponibilidad_cambio() {
        long o=orden(),f=oferta(o); actor(tecnico());
        jdbc.queryForObject("SELECT orders.cambiar_disponibilidad(false)",String.class);
        assertThat(jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,f,tecnico())).isFalse();
    }
    @Test void oferta_no_se_acepta_si_cobertura_cambio() {
        long o=orden(),f=oferta(o); actor(tecnico());
        jdbc.queryForObject("SELECT orders.cambiar_disponibilidad(true)",String.class);
        jdbc.update("UPDATE geo.zonas_cobertura SET activo=false WHERE tecnico_id=?",tecnico());
        assertThat(jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,f,tecnico())).isFalse();
    }
    @Test void oferta_vencida_no_asigna() {
        long o=orden(),f=oferta(o); actor(tecnico());
        jdbc.update("UPDATE orders.ofertas_orden SET enviada_en=now()-interval '3 minutes',expira_en=now()-interval '1 minute' WHERE id=?",f);
        assertThat(jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,f,tecnico())).isFalse();
    }
    @Test void codigo_solo_cliente_no_aparece_en_snapshot_y_no_se_persiste_en_claro() throws Exception {
        long o=asignada(); String c=token("maria.quispe@ejemplo.bo"),t=token("diego.vargas@ejemplo.bo");
        String codigo=leer(postJson("/api/servicios/"+o+"/atencion/codigo",c,"{}").andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store")).andReturn(),"$.codigo");
        assertThat(codigo).matches("\\d{8}");
        assertThat(jdbc.queryForObject("SELECT codigo_hash FROM orders.atenciones WHERE orden_id=?",String.class,o)).isNotEqualTo(codigo).hasSize(64);
        mvc.perform(get("/api/servicios/"+o+"/atencion").header("Authorization","Bearer "+t)).andExpect(status().isOk())
            .andExpect(jsonPath("$.codigo").doesNotExist()).andExpect(jsonPath("$.codigoHash").doesNotExist())
            .andExpect(jsonPath("$.latitud").doesNotExist());
        postJson("/api/servicios/"+o+"/atencion/llegada",t,"{\"codigo\":\""+codigo+"\"}").andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT codigo_hash FROM orders.atenciones WHERE orden_id=?",String.class,o)).isNull();
        assertThat(jdbc.queryForObject("SELECT estado::text FROM orders.ordenes_servicio WHERE id=?",String.class,o)).isEqualTo("en_diagnostico");
    }
    @Test void otro_cliente_no_obtiene_atencion_ni_evidencia() throws Exception {
        long o=asignada(); String otro=token("jorge.mamani@ejemplo.bo");
        mvc.perform(get("/api/servicios/"+o+"/atencion").header("Authorization","Bearer "+otro)).andExpect(status().isNotFound());
        mvc.perform(get("/api/servicios/"+o+"/atencion/evidencia").header("Authorization","Bearer "+otro)).andExpect(status().isNotFound());
    }
    @Test void llegada_directa_no_omite_codigo() throws Exception {
        long o=asignada();
        postJson("/api/tecnicos/servicios/"+o+"/llegada",token("diego.vargas@ejemplo.bo"),"{}").andExpect(status().isConflict());
    }
    @Test void buscar_sin_candidatos_termina_y_permite_reintento_auditable() {
        long o=orden(); jdbc.update("UPDATE orders.busquedas_servicio SET hasta=clock_timestamp()-interval '1 minute' WHERE orden_id=?",o);
        jdbc.queryForObject("SELECT orders.mantener_ofertas()",Integer.class);
        assertThat(jdbc.queryForObject("SELECT estado FROM orders.busquedas_servicio WHERE orden_id=?",String.class,o)).isEqualTo("sin_disponibilidad");
        actor(cliente()); jdbc.queryForObject("SELECT orders.reintentar_busqueda(?,?)",(rs,n)->null,o,revision(o));
        assertThat(jdbc.queryForObject("SELECT intento FROM orders.busquedas_servicio WHERE orden_id=?",Integer.class,o)).isEqualTo(2);
    }
    @Test void coordinacion_cierra_diagnostico_rechazado_sin_cobros_y_libera_tecnico() throws Exception {
        long o=asignada(); actor(id("admin@fixly.bo"));
        jdbc.queryForObject("SELECT admin_svc.resolver_atencion(?,?,?,'Cliente no desea reparar',NULL)",(rs,n)->null,
            o,revision(o),"cancelar");
        assertThat(jdbc.queryForObject("SELECT estado::text FROM orders.ordenes_servicio WHERE id=?",String.class,o)).isEqualTo("cancelado");
        assertThat(jdbc.queryForObject("SELECT disponibilidad::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,tecnico())).isEqualTo("disponible");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM billing.pagos WHERE orden_id=?",Integer.class,o)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM orders.eventos_atencion WHERE orden_id=?",Integer.class,o)).isEqualTo(2);
    }
    @Test void revision_obsoleta_se_rechaza() throws Exception {
        long o=asignada();
        postJson("/api/servicios/"+o+"/atencion/incidencia",token("maria.quispe@ejemplo.bo"),
            "{\"revision\":0,\"accion\":\"solicitar_coordinacion\",\"motivo\":\"Necesito reprogramar la atención\"}").andExpect(status().isConflict());
    }
    @Test void pausa_reanuda_y_conserva_fecha_sin_alterar_estado_principal() {
        long o=asignada(); actor(id("admin@fixly.bo"));
        jdbc.queryForObject("SELECT admin_svc.resolver_atencion(?,?,?,'Verificación presencial excepcional',NULL)",(rs,n)->null,
            o,revision(o),"llegada_justificada");
        actor(tecnico());
        jdbc.queryForObject("SELECT orders.gestionar_incidencia(?,?,?,'Esperando un repuesto compatible',clock_timestamp()+interval '1 day')",
            (rs,n)->null,o,revision(o),"pausar");
        assertThat(jdbc.queryForObject("SELECT pausa_motivo FROM orders.atenciones WHERE orden_id=?",String.class,o)).contains("repuesto");
        jdbc.queryForObject("SELECT orders.gestionar_incidencia(?,?,?,'Ya contamos con el repuesto',NULL)",(rs,n)->null,o,revision(o),"reanudar");
        assertThat(jdbc.queryForObject("SELECT pausa_motivo FROM orders.atenciones WHERE orden_id=?",String.class,o)).isNull();
        assertThat(jdbc.queryForObject("SELECT estado::text FROM orders.ordenes_servicio WHERE id=?",String.class,o)).isEqualTo("en_diagnostico");
    }
    @Test void equipos_y_sucursales_no_se_comparten_entre_cuentas() throws Exception {
        String email=jdbc.queryForObject("SELECT email FROM identity.usuarios WHERE tipo_cliente='empresa' AND activo ORDER BY id LIMIT 1",String.class);
        String empresa=token(email);
        long sucursal=((Number)leer(postJson("/api/sucursales",empresa,
            "{\"nombre\":\"Sucursal Centro\",\"referencia\":\"Avenida principal, puerta azul\",\"activa\":true}")
            .andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        long equipo=((Number)leer(postJson("/api/equipos",empresa,
            "{\"sucursal\":"+sucursal+",\"nombre\":\"Bomba de agua\",\"activo\":true}")
            .andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        mvc.perform(get("/api/equipos/"+equipo+"/historial").header("Authorization","Bearer "+token("maria.quispe@ejemplo.bo")))
            .andExpect(status().isNotFound());
        postJson("/api/equipos",token("maria.quispe@ejemplo.bo"),
            "{\"sucursal\":"+sucursal+",\"nombre\":\"Equipo ajeno\",\"activo\":true}").andExpect(status().isForbidden());
    }
    @Test void equipo_vinculado_conserva_nombre_historico_y_tiene_auditoria() {
        actor(cliente());
        long equipo=jdbc.queryForObject("SELECT orders.guardar_equipo(NULL,NULL,NULL,'Refrigerador','Marca','Modelo','EQ-1',true)",Long.class);
        long o=orden(); jdbc.queryForObject("SELECT orders.vincular_equipo(?,?)",(rs,n)->null,o,equipo);
        jdbc.queryForObject("SELECT orders.guardar_equipo(?,0,NULL,'Equipo renombrado',NULL,NULL,NULL,true)",Long.class,equipo);
        assertThat(jdbc.queryForObject("SELECT nombre_snapshot FROM orders.equipos_orden WHERE orden_id=?",String.class,o)).isEqualTo("Refrigerador");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM orders.auditoria_equipos WHERE sujeto_id=? AND origen='equipos_cliente'",Integer.class,equipo)).isEqualTo(2);
    }
    @Test void otro_cliente_no_vincula_equipo_ajeno() {
        actor(cliente());
        long equipo=jdbc.queryForObject("SELECT orders.guardar_equipo(NULL,NULL,NULL,'Refrigerador',NULL,NULL,NULL,true)",Long.class);
        long o=orden(); actor(id("jorge.mamani@ejemplo.bo"));
        assertThatThrownBy(()->jdbc.queryForObject("SELECT orders.vincular_equipo(?,?)",(rs,n)->null,o,equipo))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void indicadores_solo_coordinacion_y_muestras_explicitas() throws Exception {
        mvc.perform(get("/api/admin/operacion").header("Authorization","Bearer "+token("maria.quispe@ejemplo.bo"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/operacion").header("Authorization","Bearer "+token("admin@fixly.bo"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.indicadores.creadas").isNumber()).andExpect(jsonPath("$.indicadores.llegadas").isNumber())
            .andExpect(jsonPath("$.ingresos").doesNotExist());
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void aceptaciones_concurrentes_de_dos_ordenes_serializan_por_tecnico() throws Exception {
        long t=tecnico(),a=orden(),b=orden(),fa=oferta(a),fb=oferta(b);
        var tx=new TransactionTemplate(tm);
        tx.execute(s->{actor(t);jdbc.queryForObject("SELECT orders.cambiar_disponibilidad(true)",String.class);return null;});
        try(var executor=Executors.newFixedThreadPool(2)) {
            var inicio=new CountDownLatch(1);
            Callable<Boolean> primera=()->{inicio.await();return tx.execute(s->{actor(t);return jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,fa,t);});};
            Callable<Boolean> segunda=()->{inicio.await();return tx.execute(s->{actor(t);return jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,fb,t);});};
            var x=executor.submit(primera);var y=executor.submit(segunda);inicio.countDown();
            assertThat(List.of(x.get(15,TimeUnit.SECONDS),y.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        } finally { limpiarFixture(a); limpiarFixture(b); jdbc.update("UPDATE identity.perfiles_tecnico SET disponibilidad='disponible' WHERE usuario_id=?",t); }
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void cinco_intentos_erroneos_persisten_tras_respuesta_http_400() throws Exception {
        long o=orden(),t=tecnico(); var tx=new TransactionTemplate(tm);
        try {
            tx.execute(s->{actor(t);jdbc.queryForObject("SELECT orders.cambiar_disponibilidad(true)",String.class);
                jdbc.queryForObject("SELECT orders.tomar_servicio(?)",Boolean.class,o);return null;});
            String c=token("maria.quispe@ejemplo.bo"),tokenT=token("diego.vargas@ejemplo.bo");
            String codigo=leer(postJson("/api/servicios/"+o+"/atencion/codigo",c,"{}").andExpect(status().isOk()).andReturn(),"$.codigo");
            for(int i=0;i<5;i++) postJson("/api/servicios/"+o+"/atencion/llegada",tokenT,"{\"codigo\":\"99999999\"}").andExpect(status().isBadRequest());
            assertThat(jdbc.queryForObject("SELECT intentos_codigo FROM orders.atenciones WHERE orden_id=?",Integer.class,o)).isEqualTo(5);
            postJson("/api/servicios/"+o+"/atencion/llegada",tokenT,"{\"codigo\":\""+codigo+"\"}").andExpect(status().isBadRequest());
        } finally { limpiarFixture(o);jdbc.update("UPDATE identity.perfiles_tecnico SET disponibilidad='disponible' WHERE usuario_id=?",t); }
    }
    private void limpiarFixture(long o) {
        jdbc.update("DELETE FROM notification.notificaciones WHERE orden_id=?",o);
        jdbc.update("DELETE FROM chat.mensajes WHERE conversacion_id IN(SELECT id FROM chat.conversaciones WHERE orden_id=?)",o);
        jdbc.update("DELETE FROM chat.conversaciones WHERE orden_id=?",o);
        jdbc.update("DELETE FROM orders.eventos_atencion WHERE orden_id=?",o);
        jdbc.update("DELETE FROM orders.busquedas_servicio WHERE orden_id=?",o);
        jdbc.update("DELETE FROM orders.atenciones WHERE orden_id=?",o);
        jdbc.update("DELETE FROM orders.ordenes_servicio WHERE id=?",o);
    }
}

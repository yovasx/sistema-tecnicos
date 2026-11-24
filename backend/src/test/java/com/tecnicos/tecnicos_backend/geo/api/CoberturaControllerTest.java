package com.tecnicos.tecnicos_backend.geo.api;

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
class CoberturaControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    static final String TECNICO="diego.vargas@ejemplo.bo",OTRO="lucia.fernandez@ejemplo.bo",CLIENTE="maria.quispe@ejemplo.bo";
    long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    String token(String email) throws Exception {
        return leer(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn(),"$.token");
    }
    <T> T leer(MvcResult r,String ruta) throws Exception {
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),ruta);
    }
    ResultActions enviar(String ruta,String token,String cuerpo) throws Exception {
        return mvc.perform(post(ruta).header("Authorization","Bearer "+token).contentType("application/json").content(cuerpo));
    }
    void fueraDeServicio(String email) {
        jdbc.update("UPDATE identity.perfiles_tecnico SET disponibilidad='fuera_servicio' WHERE usuario_id=?",id(email));
    }
    String propuesta(UUID clave,long revision,String motivo,int zonas) {
        String[] nombres={"Sopocachi nuevo","Miraflores nuevo","Obrajes nuevo","Calacoto nuevo","Achumani nuevo"};
        double[][] centros={{-16.4985,-68.1350},{-16.5050,-68.1150},{-16.5200,-68.1050},{-16.5450,-68.1000},{-16.5350,-68.0800}};
        StringBuilder json=new StringBuilder("{\"clave\":\""+clave+"\",\"revision\":"+revision+",\"motivo\":\""+motivo+"\",\"zonas\":[");
        for(int i=0;i<zonas;i++) {
            if(i>0) json.append(',');
            json.append("{\"nombre\":\"").append(nombres[i]).append("\",\"latitud\":").append(centros[i][0])
                .append(",\"longitud\":").append(centros[i][1]).append(",\"radioMetros\":1500}");
        }
        return json.append("]}").toString();
    }
    String punto(double lat,double lng,double precision,Instant capturado) {
        return "{\"latitud\":"+lat+",\"longitud\":"+lng+",\"precision\":"+precision+",\"capturadoEn\":\""+capturado+"\"}";
    }

    @Test void propuesta_pendiente_no_cambia_zonas_y_aprobacion_las_sustituye() throws Exception {
        fueraDeServicio(TECNICO);
        String t=token(TECNICO),a=token("admin@fixly.bo");
        mvc.perform(get("/api/tecnicos/cobertura").header("Authorization","Bearer "+t)).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.revision").value(0))
            .andExpect(jsonPath("$.zonas.length()").value(1))
            .andExpect(jsonPath("$.zonas[0].nombre").value("Sopocachi"))
            .andExpect(jsonPath("$.especialidades.length()").value(2));
        long solicitud=((Number)leer(enviar("/api/tecnicos/cobertura/propuestas",t,
            propuesta(UUID.randomUUID(),0,"Amplío mi cobertura a dos zonas",2)).andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        mvc.perform(get("/api/tecnicos/cobertura").header("Authorization","Bearer "+t))
            .andExpect(jsonPath("$.zonas.length()").value(1))
            .andExpect(jsonPath("$.solicitudes[0].estado").value("pendiente"))
            .andExpect(jsonPath("$.solicitudes[0].zonas.length()").value(2));
        // La cobertura vigente todavía no cambió.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.zonas_cobertura WHERE tecnico_id=? AND activo",
            Long.class,id(TECNICO))).isEqualTo(1);
        enviar("/api/admin/coberturas/"+solicitud+"/revisar",a,
            "{\"revision\":1,\"aprobar\":true,\"motivo\":\"Zonas verificadas en el mapa\"}")
            .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.zonas_cobertura WHERE tecnico_id=? AND activo",
            Long.class,id(TECNICO))).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.zonas_cobertura WHERE tecnico_id=? AND NOT activo",
            Long.class,id(TECNICO))).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT revision FROM geo.control_cobertura WHERE tecnico_id=?",
            Long.class,id(TECNICO))).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM geo.auditoria_cobertura WHERE solicitud_id=? AND accion='aprobar'
            """,Long.class,solicitud)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM notification.notificaciones WHERE usuario_id=? AND mensaje='Tu nueva cobertura fue aprobada.'
            """,Long.class,id(TECNICO))).isEqualTo(1);
        // El polígono nuevo es circular: centro y radio declarados, sin inventar barrios.
        assertThat(jdbc.queryForObject("""
            SELECT round(radio_metros) FROM geo.zonas_cobertura WHERE tecnico_id=? AND activo ORDER BY id LIMIT 1
            """,Integer.class,id(TECNICO))).isEqualTo(1500);
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM geo.zonas_cobertura WHERE tecnico_id=? AND activo
              AND centro IS NOT NULL AND radio_metros IS NOT NULL
            """,Long.class,id(TECNICO))).isEqualTo(2);
    }

    @Test void reintento_idempotente_conserva_una_sola_propuesta() throws Exception {
        fueraDeServicio(TECNICO);
        String t=token(TECNICO);
        String cuerpo=propuesta(UUID.randomUUID(),0,"Primera propuesta de cobertura",1);
        long primera=((Number)leer(enviar("/api/tecnicos/cobertura/propuestas",t,cuerpo)
            .andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        enviar("/api/tecnicos/cobertura/propuestas",t,cuerpo).andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(primera));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.solicitudes_cobertura WHERE tecnico_id=?",
            Long.class,id(TECNICO))).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.auditoria_cobertura WHERE solicitud_id=?",
            Long.class,primera)).isEqualTo(1);
    }

    // Cada rechazo SQL aborta la transacción de prueba: el escenario fallido cierra su propio método.
    @Test void revision_obsoleta_no_crea_propuesta() throws Exception {
        fueraDeServicio(TECNICO);
        enviar("/api/tecnicos/cobertura/propuestas",token(TECNICO),
            propuesta(UUID.randomUUID(),7,"Revisión desactualizada",1)).andExpect(status().isConflict());
    }

    @Test void segunda_propuesta_pendiente_se_rechaza() throws Exception {
        fueraDeServicio(TECNICO);
        String t=token(TECNICO);
        enviar("/api/tecnicos/cobertura/propuestas",t,propuesta(UUID.randomUUID(),0,"Propuesta inicial",1))
            .andExpect(status().isOk());
        enviar("/api/tecnicos/cobertura/propuestas",t,propuesta(UUID.randomUUID(),0,"Segunda propuesta simultánea",1))
            .andExpect(status().isConflict());
    }

    @Test void misma_clave_con_otro_contenido_se_rechaza() throws Exception {
        fueraDeServicio(TECNICO);
        String t=token(TECNICO);
        UUID clave=UUID.randomUUID();
        enviar("/api/tecnicos/cobertura/propuestas",t,propuesta(clave,0,"Propuesta original",1))
            .andExpect(status().isOk());
        enviar("/api/tecnicos/cobertura/propuestas",t,propuesta(clave,0,"Otra propuesta con la misma clave",2))
            .andExpect(status().isConflict());
    }

    @Test void no_propone_cobertura_estando_disponible() throws Exception {
        enviar("/api/tecnicos/cobertura/propuestas",token(TECNICO),
            propuesta(UUID.randomUUID(),0,"Intento estando disponible",1)).andExpect(status().isConflict());
    }

    @Test void no_propone_cobertura_con_servicio_abierto() throws Exception {
        fueraDeServicio(TECNICO);
        jdbc.update("""
            INSERT INTO orders.ordenes_servicio(cliente_id,tecnico_id,categoria_id,descripcion_falla,
                ubicacion_cliente,direccion_referencia,estado)
            VALUES(?,?,(SELECT min(categoria_id) FROM identity.tecnico_especialidades WHERE tecnico_id=?),
                'Servicio abierto de prueba',ST_SetSRID(ST_MakePoint(-68.13,-16.5),4326)::geography,
                'Referencia privada','en_camino')
            """,id(CLIENTE),id(TECNICO),id(TECNICO));
        enviar("/api/tecnicos/cobertura/propuestas",token(TECNICO),
            propuesta(UUID.randomUUID(),0,"Intento con orden abierta",1)).andExpect(status().isConflict());
    }

    @Test void aprobar_rechaza_tecnico_que_volvio_a_estar_disponible() throws Exception {
        fueraDeServicio(TECNICO);
        String t=token(TECNICO);
        long s=((Number)leer(enviar("/api/tecnicos/cobertura/propuestas",t,
            propuesta(UUID.randomUUID(),0,"Propuesta para revisar",1)).andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        jdbc.update("UPDATE identity.perfiles_tecnico SET disponibilidad='disponible' WHERE usuario_id=?",id(TECNICO));
        assertThat(jdbc.queryForObject("SELECT estado FROM geo.solicitudes_cobertura WHERE id=?",String.class,s))
            .isEqualTo("pendiente");
        enviar("/api/admin/coberturas/"+s+"/revisar",token("admin@fixly.bo"),
            "{\"revision\":1,\"aprobar\":true,\"motivo\":\"Intento de aprobación\"}")
            .andExpect(status().isConflict());
    }

    @Test void solo_admin_revisa_y_el_duenio_retira_su_propuesta() throws Exception {
        fueraDeServicio(TECNICO);
        String t=token(TECNICO);
        long s=((Number)leer(enviar("/api/tecnicos/cobertura/propuestas",t,
            propuesta(UUID.randomUUID(),0,"Propuesta privada del técnico",1)).andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        enviar("/api/admin/coberturas/"+s+"/revisar",t,
            "{\"revision\":1,\"aprobar\":true,\"motivo\":\"Autoaprobación no permitida\"}").andExpect(status().isForbidden());
        enviar("/api/admin/coberturas/"+s+"/revisar",token(CLIENTE),
            "{\"revision\":1,\"aprobar\":true,\"motivo\":\"Cliente no revisa coberturas\"}").andExpect(status().isForbidden());
        enviar("/api/tecnicos/cobertura/propuestas/"+s+"/retirar",t,"{}").andExpect(status().isNoContent());
        enviar("/api/tecnicos/cobertura/propuestas/"+s+"/retirar",t,"{}").andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT estado FROM geo.solicitudes_cobertura WHERE id=?",String.class,s))
            .isEqualTo("retirada");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.zonas_cobertura WHERE tecnico_id=? AND activo",
            Long.class,id(TECNICO))).isEqualTo(1);
    }

    @Test void otro_tecnico_no_retira_propuesta_ajena() throws Exception {
        fueraDeServicio(TECNICO);
        long s=((Number)leer(enviar("/api/tecnicos/cobertura/propuestas",token(TECNICO),
            propuesta(UUID.randomUUID(),0,"Propuesta de otro técnico",1)).andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        enviar("/api/tecnicos/cobertura/propuestas/"+s+"/retirar",token(OTRO),"{}").andExpect(status().isNotFound());
    }

    @Test void comprobacion_puntual_distingue_dentro_fuera_y_limite_sin_guardar_posicion() throws Exception {
        String t=token(TECNICO);
        enviar("/api/tecnicos/cobertura/comprobar",t,punto(-16.4985,-68.135,5,Instant.now()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("dentro"))
            .andExpect(jsonPath("$.dentro").value(true));
        enviar("/api/tecnicos/cobertura/comprobar",t,punto(-16.6000,-68.2000,5,Instant.now()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("fuera"))
            .andExpect(jsonPath("$.dentro").value(false));
        enviar("/api/tecnicos/cobertura/comprobar",t,punto(-16.4985,-68.12492,5,Instant.now()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("cerca_limite"));
        enviar("/api/tecnicos/cobertura/comprobar",t,punto(-16.4985,-68.135,5,Instant.now().minusSeconds(45)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("ubicacion_insuficiente"))
            .andExpect(jsonPath("$.dentro").value(false));
        enviar("/api/tecnicos/cobertura/comprobar",t,punto(-16.4985,-68.135,260,Instant.now()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("ubicacion_insuficiente"));
        // Una comprobación no abre seguimiento ni escribe la posición del técnico.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.ubicacion_actual WHERE tecnico_id=?",
            Long.class,id(TECNICO))).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM geo.sesiones_seguimiento WHERE tecnico_id=?",
            Long.class,id(TECNICO))).isZero();
        // Tampoco cambia la disponibilidad ni la cobertura.
        assertThat(jdbc.queryForObject("SELECT disponibilidad::text FROM identity.perfiles_tecnico WHERE usuario_id=?",
            String.class,id(TECNICO))).isEqualTo("disponible");
    }

    @Test void cobertura_propia_solo_de_tecnicos_aprobados_y_revision_de_admin_es_privada() throws Exception {
        String c=token(CLIENTE);
        mvc.perform(get("/api/tecnicos/cobertura").header("Authorization","Bearer "+c)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/coberturas").header("Authorization","Bearer "+c)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/coberturas")).andExpect(status().isUnauthorized());
        fueraDeServicio(TECNICO);
        long s=((Number)leer(enviar("/api/tecnicos/cobertura/propuestas",token(TECNICO),
            propuesta(UUID.randomUUID(),0,"Pendiente visible solo para administración",1))
            .andExpect(status().isOk()).andReturn(),"$.id")).longValue();
        mvc.perform(get("/api/admin/coberturas").header("Authorization","Bearer "+token("admin@fixly.bo")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.elementos[0].id").value(s))
            .andExpect(jsonPath("$.elementos[0].tecnicoId").value(id(TECNICO)));
        mvc.perform(get("/api/admin/tecnicos/"+id(TECNICO)+"/cobertura").header("Authorization","Bearer "+token("admin@fixly.bo")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.zonas.length()").value(1))
            .andExpect(jsonPath("$.solicitudes[0].estado").value("pendiente"));
    }
}

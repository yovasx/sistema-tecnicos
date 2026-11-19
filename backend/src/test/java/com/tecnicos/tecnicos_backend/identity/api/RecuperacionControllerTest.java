package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import com.tecnicos.tecnicos_backend.shared.mail.ServicioEmail;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Transacciones HTTP reales: los intentos y consumos persisten después de 400. */
@SpringBootTest
@AutoConfigureMockMvc
class RecuperacionControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ServicioEmail correo;
    String email,token;
    Long id;
    AtomicReference<String> codigo=new AtomicReference<>();
    final List<String> emails=new ArrayList<>();
    @BeforeEach void crear() throws Exception {
        email="recuperacion-"+UUID.randomUUID()+"@prueba.bo"; emails.add(email);
        var r=postJson("/api/auth/registro","""
            {"nombre":"Ana","apellido":"Prueba","email":"%s","password":"ClaveSegura2026!","tipoCliente":"persona"}
            """.formatted(email)).andExpect(status().isCreated()).andReturn();
        id=((Number)leer(r,"$.usuario.id")).longValue(); token=leer(r,"$.token");
        doAnswer(i->{codigo.set(i.getArgument(1));return null;}).when(correo).enviarRecuperacion(anyString(),anyString());
    }
    @AfterEach void limpiar() {
        if(id!=null) {
            jdbc.update("DELETE FROM identity.recuperaciones WHERE usuario_id=?",id);
            jdbc.update("DELETE FROM identity.usuarios WHERE id=?",id);
        }
        for(String e:emails) jdbc.update("DELETE FROM identity.limites_recuperacion WHERE email_hash=encode(digest(?,'sha256'),'hex')",e);
    }
    ResultActions postJson(String ruta,String cuerpo) throws Exception {
        return mvc.perform(post(ruta).contentType("application/json").content(cuerpo));
    }
    <T> T leer(MvcResult r,String ruta) throws Exception {
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),ruta);
    }
    String solicitar() throws Exception { return solicitar(email); }
    String solicitar(String e) throws Exception {
        return leer(postJson("/api/auth/recuperacion/solicitar","{\"email\":\""+e+"\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.codigo").doesNotExist())
            .andExpect(header().string("Cache-Control","no-store")).andReturn(),"$.solicitudId");
    }
    ResultActions confirmar(String solicitud,String c) throws Exception {
        return postJson("/api/auth/recuperacion/confirmar","{\"solicitudId\":\""+solicitud+"\",\"codigo\":\""+c+"\"}");
    }
    String permiso(String solicitud) throws Exception {
        return leer(confirmar(solicitud,codigo.get()).andExpect(status().isOk()).andReturn(),"$.permiso");
    }
    ResultActions restablecer(String solicitud,String permiso) throws Exception {
        return postJson("/api/auth/recuperacion/restablecer","""
            {"solicitudId":"%s","permiso":"%s","password":"NuevaClave2026!"}
            """.formatted(solicitud,permiso));
    }
    @Test void cambio_atomico_revoca_jwt_previo_y_no_reutiliza_permiso() throws Exception {
        String s=solicitar(),p=permiso(s);
        restablecer(s,p).andExpect(status().isOk());
        restablecer(s,p).andExpect(status().isBadRequest());
        confirmar(s,codigo.get()).andExpect(status().isBadRequest());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        postJson("/api/auth/login","{\"email\":\""+email+"\",\"password\":\"ClaveSegura2026!\"}").andExpect(status().isUnauthorized());
        var r=postJson("/api/auth/login","{\"email\":\""+email+"\",\"password\":\"NuevaClave2026!\"}")
            .andExpect(status().isOk()).andReturn();
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+leer(r,"$.token"))).andExpect(status().isOk());
    }
    @Test void cinco_intentos_persisten_y_bloquean_incluso_el_correcto() throws Exception {
        String s=solicitar(),malo=codigo.get().equals("000000")?"111111":"000000";
        for(int i=0;i<5;i++) confirmar(s,malo).andExpect(status().isBadRequest());
        confirmar(s,codigo.get()).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT intentos FROM identity.recuperaciones WHERE id=?::uuid",Integer.class,s)).isEqualTo(5);
    }
    @Test void expiracion_del_codigo_y_autorizacion() throws Exception {
        String s=solicitar();
        jdbc.update("UPDATE identity.recuperaciones SET expira_en=now()-interval '1 minute' WHERE id=?::uuid",s);
        confirmar(s,codigo.get()).andExpect(status().isBadRequest());
    }
    @Test void permiso_expirado_no_modifica_clave() throws Exception {
        String s=solicitar(),p=permiso(s);
        jdbc.update("UPDATE identity.recuperaciones SET permiso_expira_en=now()-interval '1 minute' WHERE id=?::uuid",s);
        restablecer(s,p).andExpect(status().isBadRequest());
    }
    @Test void codigo_confirmado_no_se_repite_y_permiso_inventado_no_sirve() throws Exception {
        String s=solicitar(); permiso(s);
        confirmar(s,codigo.get()).andExpect(status().isBadRequest());
        restablecer(s,"inventado").andExpect(status().isBadRequest());
    }
    @Test void inexistente_e_inactiva_devuelven_respuesta_generica_sin_email() throws Exception {
        String ausente="ausente-"+UUID.randomUUID()+"@prueba.bo"; emails.add(ausente);
        String s=solicitar(ausente);
        confirmar(s,"123456").andExpect(status().isBadRequest());
        jdbc.update("UPDATE identity.usuarios SET activo=FALSE WHERE id=?",id);
        solicitar();
        verify(correo,never()).enviarRecuperacion(anyString(),anyString());
    }
    @Test void cuenta_google_no_adquiere_password_por_recuperacion() throws Exception {
        jdbc.update("UPDATE identity.usuarios SET password_hash=NULL WHERE id=?",id);
        solicitar();
        assertThat(jdbc.queryForObject("SELECT password_hash FROM identity.usuarios WHERE id=?",String.class,id)).isNull();
        verify(correo,never()).enviarRecuperacion(anyString(),anyString());
    }
    @Test void cooldown_no_invalida_el_codigo_enviado_y_reenvio_si() throws Exception {
        String anterior=solicitar();
        solicitar();
        verify(correo,times(1)).enviarRecuperacion(anyString(),anyString());
        jdbc.update("UPDATE identity.limites_recuperacion SET ultimo=now()-interval '61 seconds' WHERE email_hash=encode(digest(?,'sha256'),'hex')",email);
        String siguiente=solicitar();
        confirmar(anterior,codigo.get()).andExpect(status().isBadRequest());
        confirmar(siguiente,codigo.get()).andExpect(status().isOk());
    }
    @Test void maximo_cinco_envios_por_hora() throws Exception {
        for(int i=0;i<6;i++) {
            jdbc.update("UPDATE identity.limites_recuperacion SET ultimo=now()-interval '61 seconds' WHERE email_hash=encode(digest(?,'sha256'),'hex')",email);
            solicitar();
        }
        verify(correo,times(5)).enviarRecuperacion(anyString(),anyString());
    }
    @Test void falla_smtp_es_generica_y_el_codigo_se_invalida() throws Exception {
        doThrow(new IllegalStateException()).when(correo).enviarRecuperacion(anyString(),anyString());
        solicitar();
        assertThat(jdbc.queryForObject("SELECT bool_and(consumido) FROM identity.recuperaciones WHERE usuario_id=?",Boolean.class,id)).isTrue();
    }
    @Test void desafio_ajeno_no_autoriza_el_cambio() throws Exception {
        String s=solicitar(),p=permiso(s);
        restablecer(UUID.randomUUID().toString(),p).andExpect(status().isBadRequest());
    }
}

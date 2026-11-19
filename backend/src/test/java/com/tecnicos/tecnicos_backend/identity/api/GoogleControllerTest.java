package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import com.tecnicos.tecnicos_backend.identity.application.VerificadorGoogle;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** La firma se prueba en VerificadorGoogleTest; aquí se prueban persistencia y políticas. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GoogleControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean VerificadorGoogle verificador;
    String email,sujeto,nonce;
    @BeforeEach void preparar() throws Exception {
        email="google-"+UUID.randomUUID()+"@prueba.bo"; sujeto=UUID.randomUUID().toString();
        when(verificador.habilitado()).thenReturn(true);
        nonce=leer(postJson("/api/auth/google/desafio","{}").andExpect(status().isOk()).andReturn(),"$.nonce");
        when(verificador.verificar(anyString(),anyString())).thenAnswer(i->perfil(true));
    }
    Jwt perfil(boolean nombres) {
        var b=Jwt.withTokenValue("token-test").header("alg","RS256").subject(sujeto)
            .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600))
            .claim("email",email).claim("nonce",nonce);
        if (nombres) b.claim("given_name","Ana").claim("family_name","Prueba");
        return b.build();
    }
    ResultActions postJson(String ruta,String cuerpo) throws Exception {
        return mvc.perform(post(ruta).contentType("application/json").content(cuerpo));
    }
    <T> T leer(MvcResult r,String ruta) throws Exception {
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),ruta);
    }
    String datos() { return "{\"idToken\":\"token-test\",\"nonce\":\""+nonce+"\"}"; }
    MvcResult registrarLocal() throws Exception {
        return postJson("/api/auth/registro","""
            {"nombre":"Ana","apellido":"Prueba","email":"%s","password":"ClaveSegura2026!","tipoCliente":"persona"}
            """.formatted(email)).andExpect(status().isCreated()).andReturn();
    }
    @Test void crea_solo_cliente_persona_sin_password_local() throws Exception {
        var r=postJson("/api/auth/google",datos()).andExpect(status().isOk())
            .andExpect(jsonPath("$.usuario.rol").value("cliente"))
            .andExpect(jsonPath("$.usuario.tipoCliente").value("persona")).andReturn();
        long id=((Number)leer(r,"$.usuario.id")).longValue();
        assertThat(jdbc.queryForObject("SELECT password_hash FROM identity.usuarios WHERE id=?",String.class,id)).isNull();
        postJson("/api/auth/login","{\"email\":\""+email+"\",\"password\":\"cualquier-clave\"}").andExpect(status().isUnauthorized());
    }
    @Test void login_con_nuevo_nonce_reutiliza_identidad_y_no_crea_otra_cuenta() throws Exception {
        var primero=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
        var segundo=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        assertThat((Object)leer(primero,"$.usuario.id")).isEqualTo(leer(segundo,"$.usuario.id"));
    }
    @Test void no_fusiona_cuenta_local_por_coincidir_email() throws Exception {
        registrarLocal();
        postJson("/api/auth/google",datos()).andExpect(status().isConflict())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_VINCULACION_REQUERIDA"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.identidades_google WHERE sujeto=?",Integer.class,sujeto)).isZero();
    }
    @Test void faltan_nombres_se_piden_sin_inventarlos() throws Exception {
        when(verificador.verificar(anyString(),anyString())).thenAnswer(i->perfil(false));
        postJson("/api/auth/google",datos()).andExpect(status().isUnprocessableContent())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_DATOS_REQUERIDOS"));
    }
    @Test void no_admite_reutilizar_desafio() throws Exception {
        postJson("/api/auth/google",datos()).andExpect(status().isOk());
        postJson("/api/auth/google",datos()).andExpect(status().isUnauthorized());
    }
    @Test void desafio_vencido_no_autoriza_login() throws Exception {
        jdbc.update("UPDATE identity.desafios_google SET expira_en=now()-interval '1 minute' WHERE nonce_hash=encode(digest(?,'sha256'),'hex')",nonce);
        postJson("/api/auth/google",datos()).andExpect(status().isUnauthorized());
    }
    @Test void vincular_exige_sesion_y_password_y_mismo_correo() throws Exception {
        var local=registrarLocal();
        String token=leer(local,"$.token");
        mvc.perform(post("/api/auth/google/vincular").contentType("application/json")
            .content(datos().replace("}",",\"password\":\"ClaveSegura2026!\"}"))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/google/vincular").header("Authorization","Bearer "+token).contentType("application/json")
            .content(datos().replace("}",",\"password\":\"incorrecta\"}"))).andExpect(status().isBadRequest());
    }
    @Test void vinculacion_explicita_conserva_la_cuenta_existente() throws Exception {
        var local=registrarLocal();
        String token=leer(local,"$.token");
        mvc.perform(post("/api/auth/google/vincular").header("Authorization","Bearer "+token).contentType("application/json")
            .content(datos().replace("}",",\"password\":\"ClaveSegura2026!\"}"))).andExpect(status().isOk());
        nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
        var google=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        assertThat((Object)leer(google,"$.usuario.id")).isEqualTo(leer(local,"$.usuario.id"));
    }
}

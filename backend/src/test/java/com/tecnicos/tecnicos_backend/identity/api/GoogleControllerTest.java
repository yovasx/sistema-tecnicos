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
    @Autowired jakarta.persistence.EntityManager entidades;
    @MockitoBean VerificadorGoogle verificador;
    @org.springframework.test.context.DynamicPropertySource
    static void archivosTemporales(org.springframework.test.context.DynamicPropertyRegistry r) throws Exception {
        var dir=java.nio.file.Files.createTempDirectory("fixly-google-tecnico-test-");
        r.add("app.uploads.dir",()->dir.toString());
    }
    String email,sujeto,nonce;
    @BeforeEach void preparar() throws Exception {
        email="google-"+UUID.randomUUID()+"@prueba.bo"; sujeto=UUID.randomUUID().toString();
        when(verificador.habilitado()).thenReturn(true);
        nuevoDesafio("cliente");
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
    void nuevoDesafio(String proposito) throws Exception {
        nonce=leer(postJson("/api/auth/google/desafio","{\"proposito\":\""+proposito+"\"}")
            .andExpect(status().isOk()).andReturn(),"$.nonce");
    }
    long id(MvcResult r) throws Exception { return ((Number)leer(r,"$.usuario.id")).longValue(); }
    MvcResult registrarTecnicoLocal() throws Exception {
        return postJson("/api/tecnicos/registro","""
            {"nombre":"Ana","apellido":"Prueba","email":"%s","password":"ClaveSegura2026!"}
            """.formatted(email)).andExpect(status().isCreated()).andReturn();
    }
    ResultActions vincular(String token,String clave) throws Exception {
        return mvc.perform(post("/api/auth/google/vincular").header("Authorization","Bearer "+token)
            .contentType("application/json").content(datos().replace("}",",\"password\":\""+clave+"\"}")));
    }
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
        entidades.clear();
        nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
        var segundo=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        assertThat((Object)leer(primero,"$.usuario.id")).isEqualTo(leer(segundo,"$.usuario.id"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.usuarios WHERE email=?",Integer.class,email)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.identidades_google WHERE sujeto=?",Integer.class,sujeto)).isEqualTo(1);
    }
    @Test void identidad_persistida_no_depende_del_email_o_nombres_actuales_de_google() throws Exception {
        var primero=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        email="otro-"+UUID.randomUUID()+"@prueba.bo";
        when(verificador.verificar(anyString(),anyString())).thenAnswer(i->perfil(false));
        entidades.clear();
        nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
        var segundo=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        assertThat((Object)leer(segundo,"$.usuario.id")).isEqualTo(leer(primero,"$.usuario.id"));
        assertThat((Object)leer(segundo,"$.usuario.email")).isEqualTo(leer(primero,"$.usuario.email"));
    }
    @Test void otra_identidad_mismo_email_no_fusiona_ni_pide_password_inexistente() throws Exception {
        postJson("/api/auth/google",datos()).andExpect(status().isOk());
        sujeto=UUID.randomUUID().toString();
        nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
        postJson("/api/auth/google",datos()).andExpect(status().isConflict())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_IDENTIDAD_DIFERENTE"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.identidades_google WHERE sujeto=?",Integer.class,sujeto)).isZero();
    }
    @Test void cuenta_google_inactiva_no_reingresa() throws Exception {
        var primero=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        jdbc.update("UPDATE identity.usuarios SET activo=false WHERE id=?",((Number)leer(primero,"$.usuario.id")).longValue());
        entidades.clear();
        nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
        postJson("/api/auth/google",datos()).andExpect(status().isUnauthorized());
    }
    @Test
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void reingreso_entre_transacciones_reales_conserva_cuenta_y_password_nula() throws Exception {
        String inicial=nonce;
        try {
            var primero=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
            nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
            var segundo=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
            assertThat((Object)leer(segundo,"$.usuario.id")).isEqualTo(leer(primero,"$.usuario.id"));
            String token=leer(segundo,"$.token");
            mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
            assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.usuarios WHERE email=?",Integer.class,email)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT password_hash FROM identity.usuarios WHERE email=?",String.class,email)).isNull();
        } finally {
            // Solo la identidad aleatoria de este test, en la base de QA.
            jdbc.update("DELETE FROM identity.auditoria_google WHERE usuario_id IN (SELECT id FROM identity.usuarios WHERE email=?)",email);
            jdbc.update("DELETE FROM identity.identidades_google WHERE sujeto=?",sujeto);
            jdbc.update("DELETE FROM identity.usuarios WHERE email=?",email);
            for (String n:List.of(inicial,nonce)) jdbc.update(
                "DELETE FROM identity.desafios_google WHERE nonce_hash=encode(digest(?,'sha256'),'hex')",n);
        }
    }
    @Test void no_fusiona_cuenta_local_por_coincidir_email() throws Exception {
        registrarLocal();
        postJson("/api/auth/google",datos()).andExpect(status().isConflict())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_VINCULACION_REQUERIDA"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.identidades_google WHERE sujeto=?",Integer.class,sujeto)).isZero();
    }
    @Test void tecnico_local_requiere_vinculacion_explicita_sin_duplicar_ni_convertir() throws Exception {
        email="diego.vargas@ejemplo.bo";
        postJson("/api/auth/google",datos()).andExpect(status().isConflict())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_VINCULACION_REQUERIDA"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.identidades_google WHERE sujeto=?",Integer.class,sujeto)).isZero();
        assertThat(jdbc.queryForObject("SELECT rol::text FROM identity.usuarios WHERE email=?",String.class,email)).isEqualTo("tecnico");
        postJson("/api/auth/login","{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.usuario.rol").value("tecnico"));
    }
    @Test void empresa_y_admin_no_reciben_oferta_de_vinculacion() throws Exception {
        for (String correo:List.of("contacto@ferreteria-lapaz.bo","admin@fixly.bo")) {
            email=correo;
            postJson("/api/auth/google",datos()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("GOOGLE_CUENTA_NO_COMPATIBLE"));
        }
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
        nuevoDesafio("vinculacion");
        mvc.perform(post("/api/auth/google/vincular").contentType("application/json")
            .content(datos().replace("}",",\"password\":\"ClaveSegura2026!\"}"))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/google/vincular").header("Authorization","Bearer "+token).contentType("application/json")
            .content(datos().replace("}",",\"password\":\"incorrecta\"}"))).andExpect(status().isBadRequest());
    }
    @Test void vinculacion_explicita_conserva_la_cuenta_existente() throws Exception {
        var local=registrarLocal();
        String token=leer(local,"$.token");
        nuevoDesafio("vinculacion");
        mvc.perform(post("/api/auth/google/vincular").header("Authorization","Bearer "+token).contentType("application/json")
            .content(datos().replace("}",",\"password\":\"ClaveSegura2026!\"}"))).andExpect(status().isOk());
        nonce=leer(postJson("/api/auth/google/desafio","{}").andReturn(),"$.nonce");
        var google=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        assertThat((Object)leer(google,"$.usuario.id")).isEqualTo(leer(local,"$.usuario.id"));
    }
    @Test void login_desconocido_no_crea_un_cliente_por_defecto() throws Exception {
        nuevoDesafio("acceso");
        postJson("/api/auth/google",datos()).andExpect(status().isUnprocessableContent())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_REGISTRO_REQUERIDO"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.usuarios WHERE email=?",Integer.class,email)).isZero();
    }
    @Test void proposito_no_permite_admin_empresa_ni_valores_arbitrarios() throws Exception {
        for (String tipo:List.of("administrador","empresa","superusuario")) {
            postJson("/api/auth/google/desafio","{\"proposito\":\""+tipo+"\"}").andExpect(status().isBadRequest());
        }
    }
    @Test void alta_google_tecnica_crea_solo_expediente_pendiente_sin_password() throws Exception {
        nuevoDesafio("tecnico");
        var r=postJson("/api/auth/google",datos()).andExpect(status().isOk())
            .andExpect(jsonPath("$.usuario.rol").value("tecnico")).andReturn();
        long id=id(r);
        String token=leer(r,"$.token");
        assertThat(jdbc.queryForObject("SELECT password_hash FROM identity.usuarios WHERE id=?",String.class,id)).isNull();
        assertThat(jdbc.queryForObject("SELECT expediente_requerido FROM identity.perfiles_tecnico WHERE usuario_id=?",Boolean.class,id)).isTrue();
        mvc.perform(get("/api/tecnicos/expediente").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nivel").value(0))
            .andExpect(jsonPath("$.estadoExpediente").value("borrador"))
            .andExpect(jsonPath("$.disponibilidad").value("fuera_servicio"))
            .andExpect(jsonPath("$.emailVerificadoEn").isEmpty()).andExpect(jsonPath("$.ci").isEmpty());
        assertThat(jdbc.queryForObject("SELECT estado_validacion::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,id))
            .isEqualTo("pendiente");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.auditoria_google WHERE usuario_id=? AND accion='registrar'",Integer.class,id)).isEqualTo(1);
        mvc.perform(get("/api/admin/tecnicos").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/ordenes").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/perfil/password").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"actual\":\"inexistente\",\"nueva\":\"NuevaClave2026!\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("SIN_PASSWORD_LOCAL"));
        var claims=new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]),StandardCharsets.UTF_8);
        assertThat(claims).doesNotContain("ciFrente","certificaciones","fechaNacimiento","password");
        mvc.perform(post("/api/tecnicos/expediente/enviar").header("Authorization","Bearer "+token))
            .andExpect(status().isUnprocessableContent());
    }
    @Test void tecnico_google_reingresa_y_conserva_avance_guardado() throws Exception {
        nuevoDesafio("tecnico");
        var r=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        String token=leer(r,"$.token");
        mvc.perform(put("/api/tecnicos/expediente/datos-personales").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"ci\":\"87654321\",\"fechaNacimiento\":\"1995-04-10\"}"))
            .andExpect(status().isOk());
        entidades.clear(); nuevoDesafio("acceso");
        var otra=postJson("/api/auth/google",datos()).andExpect(status().isOk())
            .andExpect(jsonPath("$.usuario.id").value(id(r))).andExpect(jsonPath("$.usuario.rol").value("tecnico")).andReturn();
        mvc.perform(get("/api/tecnicos/expediente").header("Authorization","Bearer "+leer(otra,"$.token")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ci").value("87654321"))
            .andExpect(jsonPath("$.estadoExpediente").value("borrador"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.perfiles_tecnico WHERE usuario_id=?",Integer.class,id(r))).isEqualTo(1);
    }
    @Test void vinculacion_de_tecnico_aprobado_conserva_expediente_y_ambos_accesos() throws Exception {
        email="diego.vargas@ejemplo.bo";
        var local=postJson("/api/auth/login","{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")
            .andExpect(status().isOk()).andReturn();
        long id=id(local);
        String antes=jdbc.queryForObject("SELECT row_to_json(p)::text FROM identity.perfiles_tecnico p WHERE usuario_id=?",String.class,id);
        nuevoDesafio("vinculacion");
        vincular(leer(local,"$.token"),"Fixly2026!").andExpect(status().isOk());
        entidades.clear(); nuevoDesafio("acceso");
        postJson("/api/auth/google",datos()).andExpect(status().isOk())
            .andExpect(jsonPath("$.usuario.id").value(id)).andExpect(jsonPath("$.usuario.rol").value("tecnico"));
        assertThat(jdbc.queryForObject("SELECT row_to_json(p)::text FROM identity.perfiles_tecnico p WHERE usuario_id=?",String.class,id)).isEqualTo(antes);
        postJson("/api/auth/login","{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}").andExpect(status().isOk());
    }
    @Test void vincular_tecnico_pendiente_no_aprueba_ni_cambia_su_identidad() throws Exception {
        var local=registrarTecnicoLocal();
        long id=id(local);
        String antes=jdbc.queryForObject("SELECT row_to_json(p)::text FROM identity.perfiles_tecnico p WHERE usuario_id=?",String.class,id);
        nuevoDesafio("vinculacion");
        vincular(leer(local,"$.token"),"ClaveSegura2026!").andExpect(status().isOk());
        entidades.clear(); nuevoDesafio("acceso");
        postJson("/api/auth/google",datos()).andExpect(status().isOk())
            .andExpect(jsonPath("$.usuario.id").value(id)).andExpect(jsonPath("$.usuario.nombre").value("Ana Prueba"));
        assertThat(jdbc.queryForObject("SELECT row_to_json(p)::text FROM identity.perfiles_tecnico p WHERE usuario_id=?",String.class,id)).isEqualTo(antes);
    }
    @Test void no_cambia_rol_de_una_identidad_existente_por_elegir_otro_registro() throws Exception {
        var cliente=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
        nuevoDesafio("tecnico");
        postJson("/api/auth/google",datos()).andExpect(status().isOk())
            .andExpect(jsonPath("$.usuario.id").value(id(cliente))).andExpect(jsonPath("$.usuario.rol").value("cliente"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.perfiles_tecnico WHERE usuario_id=?",Integer.class,id(cliente))).isZero();
    }
    @Test void no_puede_cambiar_contexto_de_acceso_a_registro_o_vinculacion_en_el_cuerpo() throws Exception {
        nuevoDesafio("acceso");
        postJson("/api/auth/google",datos().replace("}",",\"proposito\":\"tecnico\",\"rol\":\"administrador\"}"))
            .andExpect(status().isUnprocessableContent()).andExpect(jsonPath("$.codigo").value("GOOGLE_REGISTRO_REQUERIDO"));
        var local=registrarLocal();
        vincular(leer(local,"$.token"),"ClaveSegura2026!").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_CONTEXTO_INVALIDO"));
        nuevoDesafio("vinculacion");
        postJson("/api/auth/google",datos()).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_CONTEXTO_INVALIDO"));
    }
    @Test void no_vincula_otro_email_ni_reemplaza_un_vinculo_existente() throws Exception {
        var local=registrarTecnicoLocal();
        String original=email;
        email="otro-"+UUID.randomUUID()+"@prueba.bo"; nuevoDesafio("vinculacion");
        vincular(leer(local,"$.token"),"ClaveSegura2026!").andExpect(status().isBadRequest());
        email=original; nuevoDesafio("vinculacion");
        vincular(leer(local,"$.token"),"ClaveSegura2026!").andExpect(status().isOk());
        sujeto=UUID.randomUUID().toString(); nuevoDesafio("vinculacion");
        vincular(leer(local,"$.token"),"ClaveSegura2026!").andExpect(status().isConflict())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_YA_VINCULADO"));
    }
    @Test void vinculacion_rechaza_password_utf8_demasiado_larga_sin_error_interno() throws Exception {
        var local=registrarTecnicoLocal(); nuevoDesafio("vinculacion");
        vincular(leer(local,"$.token"),"ñ".repeat(40)).andExpect(status().isBadRequest());
    }
    @Test void credencial_google_vencida_al_vincular_no_revoca_la_sesion_local() throws Exception {
        var local=registrarTecnicoLocal(); nuevoDesafio("vinculacion");
        jdbc.update("UPDATE identity.desafios_google SET expira_en=now()-interval '1 minute' WHERE nonce_hash=encode(digest(?,'sha256'),'hex')",nonce);
        String token=leer(local,"$.token");
        vincular(token,"ClaveSegura2026!").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.codigo").value("GOOGLE_INVALIDO"));
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isOk());
    }
    private void completarExpediente(String token,long id) throws Exception {
        mvc.perform(put("/api/tecnicos/expediente/datos-personales").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"ci\":\""+(10000000+id)+"\",\"fechaNacimiento\":\"1995-04-10\"}"))
            .andExpect(status().isOk());
        var archivos=multipart("/api/tecnicos/expediente/documentos");
        for (String campo:List.of("ci_frente","ci_dorso","certificaciones")) {
            archivos.file(new org.springframework.mock.web.MockMultipartFile(campo,"prueba.pdf","application/pdf",
                "%PDF-1.7\nDocumento de prueba\n%%EOF".getBytes(StandardCharsets.UTF_8)));
        }
        mvc.perform(archivos.header("Authorization","Bearer "+token)).andExpect(status().isOk());
        int categoria=jdbc.queryForObject("SELECT min(id) FROM orders.categorias_servicio WHERE activa",Integer.class);
        mvc.perform(put("/api/tecnicos/expediente/especialidades").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"categorias\":["+categoria+"]}")).andExpect(status().isOk());
        mvc.perform(put("/api/tecnicos/expediente/zonas").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"nombre\":\"Sopocachi\",\"lat\":-16.51,\"lng\":-68.12,\"radio\":1500}"))
            .andExpect(status().isOk());
        mvc.perform(post("/api/tecnicos/expediente/enviar").header("Authorization","Bearer "+token)).andExpect(status().isOk());
    }
    @Test void reingreso_respeta_revision_observaciones_rechazo_y_aprobacion_humana() throws Exception {
        String admin=leer(postJson("/api/auth/login","{\"email\":\"admin@fixly.bo\",\"password\":\"Fixly2026!\"}")
            .andExpect(status().isOk()).andReturn(),"$.token");
        for (String estado:List.of("en_revision","observado","rechazado","aprobado")) {
            email="google-estado-"+UUID.randomUUID()+"@prueba.bo"; sujeto=UUID.randomUUID().toString();
            nuevoDesafio("tecnico");
            var alta=postJson("/api/auth/google",datos()).andExpect(status().isOk()).andReturn();
            long id=id(alta);
            String token=leer(alta,"$.token");
            completarExpediente(token,id);
            if (!estado.equals("en_revision")) {
                String accion=switch(estado) { case "observado" -> "observar"; case "rechazado" -> "rechazar"; default -> "aprobar"; };
                var solicitud=post("/api/admin/tecnicos/expedientes/"+id+"/"+accion).header("Authorization","Bearer "+admin);
                if (estado.equals("observado")) solicitud.contentType("application/json")
                    .content("{\"observaciones\":{\"ciFrenteUrl\":\"La imagen debe ser legible.\"}}");
                if (estado.equals("rechazado")) solicitud.contentType("application/json")
                    .content("{\"motivo\":\"Los certificados no corresponden al solicitante.\"}");
                mvc.perform(solicitud).andExpect(status().isOk());
            }
            String antes=jdbc.queryForObject("SELECT row_to_json(p)::text FROM identity.perfiles_tecnico p WHERE usuario_id=?",String.class,id);
            int revisiones=jdbc.queryForObject("SELECT count(*) FROM identity.revisiones_tecnico WHERE tecnico_id=?",Integer.class,id);
            entidades.clear(); nuevoDesafio("acceso");
            var acceso=postJson("/api/auth/google",datos()).andExpect(status().isOk())
                .andExpect(jsonPath("$.usuario.id").value(id)).andReturn();
            mvc.perform(get("/api/tecnicos/expediente").header("Authorization","Bearer "+leer(acceso,"$.token")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estadoExpediente").value(estado));
            assertThat(jdbc.queryForObject("SELECT row_to_json(p)::text FROM identity.perfiles_tecnico p WHERE usuario_id=?",String.class,id)).isEqualTo(antes);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.revisiones_tecnico WHERE tecnico_id=?",Integer.class,id)).isEqualTo(revisiones);
        }
    }
    @Test
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void altas_tecnicas_simultaneas_conservan_un_usuario_y_un_expediente() throws Exception {
        String inicial=nonce;
        nuevoDesafio("tecnico"); String n1=nonce;
        nuevoDesafio("tecnico"); String n2=nonce;
        var inicio=new java.util.concurrent.CountDownLatch(1);
        try (var tareas=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var resultados=new ArrayList<java.util.concurrent.Future<MvcResult>>();
            for (String n:List.of(n1,n2)) resultados.add(tareas.submit(()->{
                inicio.await();
                return postJson("/api/auth/google","{\"idToken\":\"token-test\",\"nonce\":\""+n+"\"}")
                    .andExpect(status().isOk()).andReturn();
            }));
            inicio.countDown();
            var a=resultados.get(0).get(20,java.util.concurrent.TimeUnit.SECONDS);
            var b=resultados.get(1).get(20,java.util.concurrent.TimeUnit.SECONDS);
            assertThat(id(a)).isEqualTo(id(b));
            assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.usuarios WHERE email=?",Integer.class,email)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.perfiles_tecnico WHERE usuario_id=?",Integer.class,id(a))).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.auditoria_google WHERE usuario_id=? AND accion='registrar'",Integer.class,id(a))).isEqualTo(1);
        } finally {
            // Solo el usuario aleatorio creado por esta prueba en la base aislada.
            jdbc.update("DELETE FROM identity.auditoria_google WHERE usuario_id IN (SELECT id FROM identity.usuarios WHERE email=?)",email);
            jdbc.update("DELETE FROM identity.identidades_google WHERE sujeto=?",sujeto);
            jdbc.update("DELETE FROM identity.perfiles_tecnico WHERE usuario_id IN (SELECT id FROM identity.usuarios WHERE email=?)",email);
            jdbc.update("DELETE FROM identity.usuarios WHERE email=?",email);
            for (String n:List.of(inicial,n1,n2)) jdbc.update(
                "DELETE FROM identity.desafios_google WHERE nonce_hash=encode(digest(?,'sha256'),'hex')",n);
        }
    }
}

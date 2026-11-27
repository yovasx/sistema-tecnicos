package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import com.tecnicos.tecnicos_backend.shared.mail.ServicioEmail;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Sin transacción de test: confirma que los intentos OTP persisten tras HTTP 400. */
// Compatibilidad del expediente anterior; el modo local cerrado se prueba en AtencionLocalTest.
@SpringBootTest(properties="app.empresa-local=false")
@AutoConfigureMockMvc
class TecnicoControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ServicioEmail correo;
    private String token;
    private long id;
    private final List<Long> cuentas = new ArrayList<>();
    private final AtomicReference<String> codigo = new AtomicReference<>();

    @DynamicPropertySource
    static void archivosTemporales(DynamicPropertyRegistry r) throws Exception {
        var dir=Files.createTempDirectory("fixly-expediente-test-");
        r.add("app.uploads.dir",()->dir.toString());
    }

    @BeforeEach void crear() throws Exception {
        doAnswer(inv->{codigo.set(inv.getArgument(1)); return null;}).when(correo).enviarCodigo(anyString(),anyString());
        var resultado=registro().andExpect(status().isCreated()).andReturn();
        token=JsonPath.read(cuerpo(resultado),"$.token");
        id=((Number)JsonPath.read(cuerpo(resultado),"$.usuario.id")).longValue();
    }

    @AfterEach void limpiar() {
        for (long cuenta:cuentas) {
            jdbc.update("DELETE FROM admin_svc.auditoria_usuarios WHERE usuario_id=?",cuenta);
            jdbc.update("DELETE FROM identity.revisiones_tecnico WHERE tecnico_id=?",cuenta);
            jdbc.update("DELETE FROM identity.codigos_verificacion WHERE usuario_id=?",cuenta);
            jdbc.update("DELETE FROM identity.tecnico_especialidades WHERE tecnico_id=?",cuenta);
            jdbc.update("DELETE FROM geo.zonas_cobertura WHERE tecnico_id=?",cuenta);
            jdbc.update("DELETE FROM identity.perfiles_tecnico WHERE usuario_id=?",cuenta);
            jdbc.update("DELETE FROM identity.usuarios WHERE id=?",cuenta);
        }
    }

    private ResultActions registro() throws Exception {
        var r=mvc.perform(post("/api/tecnicos/registro").contentType("application/json").content("""
            {"nombre":"Ana","apellido":"Prueba","email":"tecnico-%s@prueba.bo","password":"ClaveSegura2026!"}
            """.formatted(UUID.randomUUID())));
        if (r.andReturn().getResponse().getStatus()==201)
            cuentas.add(((Number)JsonPath.read(cuerpo(r.andReturn()),"$.usuario.id")).longValue());
        return r;
    }
    private ResultActions llamada(org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder<?> r) throws Exception {
        return mvc.perform(r.header("Authorization","Bearer "+token));
    }
    private MockHttpServletRequestBuilder json(String ruta,String valor) {
        return post(ruta).contentType("application/json").content(valor);
    }
    private void verificar() throws Exception {
        llamada(post("/api/tecnicos/verificacion/email/solicitar"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.codigoDev").doesNotExist());
        llamada(json("/api/tecnicos/verificacion/email/confirmar","{\"codigo\":\""+codigo.get()+"\"}"))
                .andExpect(status().isOk());
    }
    private MockMultipartFile documento(String campo) {
        return new MockMultipartFile(campo,"prueba.pdf","application/pdf",
                "%PDF-1.7\nDocumento de prueba\n%%EOF".getBytes(StandardCharsets.UTF_8));
    }
    private void completar() throws Exception {
        // Alta nueva: no verifica email ni salta documentación obligatoria.
        llamada(put("/api/tecnicos/expediente/datos-personales").contentType("application/json")
                .content("{\"ci\":\""+(10000000+id)+"\",\"fechaNacimiento\":\"1990-01-02\"}"))
                .andExpect(status().isOk());
        llamada(multipart("/api/tecnicos/expediente/documentos")
                .file(documento("ci_frente")).file(documento("ci_dorso")).file(documento("certificaciones")))
                .andExpect(status().isOk());
        int categoria=jdbc.queryForObject("SELECT min(id) FROM orders.categorias_servicio WHERE activa",Integer.class);
        llamada(put("/api/tecnicos/expediente/especialidades").contentType("application/json")
                .content("{\"categorias\":["+categoria+"]}")).andExpect(status().isOk());
        llamada(put("/api/tecnicos/expediente/zonas").contentType("application/json")
                .content("{\"nombre\":\"Sopocachi\",\"lat\":-16.51,\"lng\":-68.12,\"radio\":1500}"))
                .andExpect(status().isOk());
        llamada(post("/api/tecnicos/expediente/enviar")).andExpect(status().isOk());
    }
    private String admin() throws Exception {
        return JsonPath.read(cuerpo(mvc.perform(json("/api/auth/login",
            "{\"email\":\"admin@fixly.bo\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn()),"$.token");
    }
    private String cuerpo(MvcResult r) throws Exception {
        return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    @Test void registro_fija_rol_y_no_habilita_para_trabajar() throws Exception {
        llamada(get("/api/tecnicos/expediente")).andExpect(status().isOk())
            .andExpect(jsonPath("$.nivel").value(0)).andExpect(jsonPath("$.estadoExpediente").value("borrador"));
        assertThat(jdbc.queryForObject("SELECT estado_validacion::text FROM identity.perfiles_tecnico WHERE usuario_id=?",
                String.class,id)).isEqualTo("pendiente");
    }
    @Test void cinco_intentos_persisten_y_bloquean_codigo_correcto() throws Exception {
        llamada(post("/api/tecnicos/verificacion/email/solicitar")).andExpect(status().isOk());
        String malo=codigo.get().equals("000000")?"111111":"000000";
        for (int i=0;i<5;i++) llamada(json("/api/tecnicos/verificacion/email/confirmar","{\"codigo\":\""+malo+"\"}"))
                .andExpect(status().isBadRequest());
        llamada(json("/api/tecnicos/verificacion/email/confirmar","{\"codigo\":\""+codigo.get()+"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("OTP_BLOQUEADO"));
        assertThat(jdbc.queryForObject("SELECT intentos FROM identity.codigos_verificacion WHERE usuario_id=?",Integer.class,id)).isEqualTo(5);
    }
    @Test void codigo_expira_y_no_se_puede_reutilizar() throws Exception {
        verificar();
        llamada(json("/api/tecnicos/verificacion/email/confirmar","{\"codigo\":\""+codigo.get()+"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("OTP_SIN_CODIGO"));
    }
    @Test void codigo_vencido_se_rechaza() throws Exception {
        llamada(post("/api/tecnicos/verificacion/email/solicitar")).andExpect(status().isOk());
        jdbc.update("UPDATE identity.codigos_verificacion SET expira_en=now()-interval '1 minute' WHERE usuario_id=?",id);
        llamada(json("/api/tecnicos/verificacion/email/confirmar","{\"codigo\":\""+codigo.get()+"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("OTP_EXPIRADO"));
    }
    @Test void reenvio_tiene_cooldown_e_invalida_anterior() throws Exception {
        llamada(post("/api/tecnicos/verificacion/email/solicitar")).andExpect(status().isOk());
        String anterior=codigo.get();
        llamada(post("/api/tecnicos/verificacion/email/solicitar")).andExpect(status().isUnprocessableContent());
        jdbc.update("UPDATE identity.codigos_verificacion SET creado_en=now()-interval '61 seconds' WHERE usuario_id=?",id);
        llamada(post("/api/tecnicos/verificacion/email/solicitar")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT invalidado FROM identity.codigos_verificacion WHERE usuario_id=? ORDER BY id LIMIT 1",Boolean.class,id)).isTrue();
        assertThat(jdbc.queryForObject("SELECT codigo_hash FROM identity.codigos_verificacion WHERE usuario_id=? ORDER BY id DESC LIMIT 1",String.class,id))
                .isNotEqualTo(codigo.get()).isNotEqualTo(anterior);
    }
    @Test void caida_smtp_no_afirma_envio_ni_guarda_codigo() throws Exception {
        doThrow(new IllegalStateException("SMTP")).when(correo).enviarCodigo(anyString(),anyString());
        llamada(post("/api/tecnicos/verificacion/email/solicitar"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.codigo").value("EMAIL_NO_DISPONIBLE"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.codigos_verificacion WHERE usuario_id=?",Integer.class,id)).isZero();
    }
    @Test void no_envia_incompleto_pero_puede_editar_sin_verificar_email() throws Exception {
        llamada(post("/api/tecnicos/expediente/enviar")).andExpect(status().isUnprocessableContent());
        llamada(put("/api/tecnicos/expediente/datos-personales").contentType("application/json")
            .content("{\"ci\":\""+(10000000+id)+"\",\"fechaNacimiento\":\"1990-01-02\"}")).andExpect(status().isOk());
        llamada(post("/api/tecnicos/expediente/enviar")).andExpect(status().isUnprocessableContent());
    }
    @Test void ci_duplicado_responde_409() throws Exception {
        verificar();
        llamada(put("/api/tecnicos/expediente/datos-personales").contentType("application/json")
                .content("{\"ci\":\""+(10000000+id)+"\",\"fechaNacimiento\":\"1990-01-02\"}")).andExpect(status().isOk());
        long otro=((Number)JsonPath.read(cuerpo(registro().andReturn()),"$.usuario.id")).longValue();
        jdbc.update("UPDATE identity.perfiles_tecnico SET email_verificado_en=now() WHERE usuario_id=?",otro);
        String email=jdbc.queryForObject("SELECT email FROM identity.usuarios WHERE id=?",String.class,otro);
        String otroToken=JsonPath.read(cuerpo(mvc.perform(json("/api/auth/login",
                "{\"email\":\""+email+"\",\"password\":\"ClaveSegura2026!\"}")).andReturn()),"$.token");
        mvc.perform(put("/api/tecnicos/expediente/datos-personales").header("Authorization","Bearer "+otroToken)
                .contentType("application/json").content("{\"ci\":\""+(10000000+id)+"\",\"fechaNacimiento\":\"1990-01-02\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("CI_YA_REGISTRADO"));
    }
    @Test void menor_de_edad_y_archivo_disfrazado_se_rechazan() throws Exception {
        verificar();
        llamada(put("/api/tecnicos/expediente/datos-personales").contentType("application/json")
                .content("{\"ci\":\"1234567\",\"fechaNacimiento\":\"2020-01-02\"}"))
                .andExpect(status().isUnprocessableContent());
        llamada(multipart("/api/tecnicos/expediente/documentos").file(new MockMultipartFile(
                "ci_frente","mentira.jpg","image/jpeg","<script>".getBytes())))
                .andExpect(status().isBadRequest());
    }
    @Test void observar_corregir_solo_un_documento_aprobar_y_bloquear_edicion() throws Exception {
        completar();
        assertThat(jdbc.queryForObject("SELECT email_verificado_en FROM identity.perfiles_tecnico WHERE usuario_id=?",
            java.time.OffsetDateTime.class,id)).isNull();
        String administrador=admin();
        String ruta="/api/admin/tecnicos/expedientes/"+id;
        mvc.perform(json(ruta+"/observar","{\"observaciones\":{\"ciDorsoUrl\":\"La foto está borrosa\"}}")
                .header("Authorization","Bearer "+administrador)).andExpect(status().isOk());
        llamada(post("/api/tecnicos/expediente/enviar")).andExpect(status().isUnprocessableContent());
        llamada(multipart("/api/tecnicos/expediente/documentos").file(documento("ci_dorso"))).andExpect(status().isOk());
        llamada(post("/api/tecnicos/expediente/enviar")).andExpect(status().isOk());
        mvc.perform(post(ruta+"/aprobar").header("Authorization","Bearer "+administrador)).andExpect(status().isOk());
        llamada(get("/api/tecnicos/expediente")).andExpect(jsonPath("$.nivel").value(3))
                .andExpect(jsonPath("$.estadoExpediente").value("aprobado"));
        llamada(put("/api/tecnicos/expediente/datos-personales").contentType("application/json")
                .content("{\"ci\":\"1234567\",\"fechaNacimiento\":\"1990-01-02\"}"))
                .andExpect(status().isUnprocessableContent());
        assertThat(jdbc.queryForObject("SELECT estado_validacion::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,id))
                .isEqualTo("aprobado");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.revisiones_tecnico WHERE tecnico_id=?",Integer.class,id)).isEqualTo(2);
    }
    @Test void documentos_son_privados_y_sin_cache() throws Exception {
        completar();
        String url=JsonPath.read(cuerpo(llamada(get("/api/tecnicos/expediente")).andReturn()),"$.ciFrenteUrl");
        String ruta="/api/tecnicos/expediente/documentos/"+url.substring(url.lastIndexOf('/')+1);
        llamada(get(ruta)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(get(ruta)).andExpect(status().isUnauthorized());
        long otro=((Number)JsonPath.read(cuerpo(registro().andReturn()),"$.usuario.id")).longValue();
        String email=jdbc.queryForObject("SELECT email FROM identity.usuarios WHERE id=?",String.class,otro);
        String otroToken=JsonPath.read(cuerpo(mvc.perform(json("/api/auth/login",
            "{\"email\":\""+email+"\",\"password\":\"ClaveSegura2026!\"}")).andReturn()),"$.token");
        mvc.perform(get(ruta).header("Authorization","Bearer "+otroToken)).andExpect(status().isNotFound());
    }
    @Test void solo_admin_puede_aprobar() throws Exception {
        llamada(post("/api/admin/tecnicos/expedientes/"+id+"/aprobar")).andExpect(status().isForbidden());
        mvc.perform(get("/api/tecnicos/expediente")).andExpect(status().isUnauthorized());
    }
    @Test void admin_descarga_documentos_de_tecnico_inactivo_sin_habilitarlo() throws Exception {
        completar();
        String url=JsonPath.read(cuerpo(llamada(get("/api/tecnicos/expediente")).andReturn()),"$.ciFrenteUrl");
        String ruta="/api/tecnicos/expediente/documentos/"+url.substring(url.lastIndexOf('/')+1);
        String administrador=admin();
        long revision=jdbc.queryForObject("SELECT revision_admin FROM identity.usuarios WHERE id=?",Long.class,id);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/admin/usuarios/"+id+"/estado")
            .header("Authorization","Bearer "+administrador).contentType("application/json")
            .content("{\"revision\":"+revision+",\"activo\":false,\"motivo\":\"Revisión de cuenta inactiva\"}"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/admin/tecnicos/"+id).header("Authorization","Bearer "+administrador))
            .andExpect(status().isOk()).andExpect(jsonPath("$.cuenta.activo").value(false));
        mvc.perform(get(ruta).header("Authorization","Bearer "+administrador))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
        llamada(get("/api/tecnicos/expediente")).andExpect(status().isUnauthorized());
    }
    @Test void tecnico_sin_validar_no_acepta_ofertas_en_la_base() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                jdbc.queryForObject("SELECT orders.aceptar_oferta(-1,?)",Boolean.class,id))
                .isInstanceOf(org.springframework.dao.DataAccessException.class)
                .rootCause()
                .hasMessageContaining("técnico");
    }
    @Test void cliente_no_accede_al_expediente_tecnico() throws Exception {
        String cliente=JsonPath.read(cuerpo(mvc.perform(json("/api/auth/login",
            "{\"email\":\"maria.quispe@ejemplo.bo\",\"password\":\"Fixly2026!\"}")).andReturn()),"$.token");
        mvc.perform(get("/api/tecnicos/expediente").header("Authorization","Bearer "+cliente))
                .andExpect(status().isForbidden());
    }
    @Test void rechazo_auditado_y_bloquea_panel_y_edicion() throws Exception {
        completar();
        mvc.perform(json("/api/admin/tecnicos/expedientes/"+id+"/rechazar","{\"motivo\":\"Certificado no válido\"}")
                .header("Authorization","Bearer "+admin())).andExpect(status().isOk());
        llamada(get("/api/tecnicos/expediente")).andExpect(jsonPath("$.estadoExpediente").value("rechazado"));
        llamada(post("/api/tecnicos/expediente/enviar")).andExpect(status().isUnprocessableContent());
        assertThat(jdbc.queryForObject("SELECT estado_validacion::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,id))
                .isEqualTo("rechazado");
    }
}

package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SCRUM-14: login con las cuentas sembradas en V2.
 *
 * <p>La clase es {@code @Transactional} para poder crear cuentas inactivas o
 * eliminadas sin ensuciar los seeds: cada test revierte sus cambios.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthControllerTest {

    private static final String EMAIL_TECNICO = "diego.vargas@ejemplo.bo";
    private static final String CLAVE = "Fixly2026!";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuarioRepository usuarios;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtDecoder jwtDecoder;

    @Autowired
    private AuditoriaContexto auditoria;

    @Test
    void un_tecnico_sembrado_entra_y_recibe_su_token() throws Exception {
        MvcResult resultado = login(EMAIL_TECNICO, CLAVE);

        assertThat(resultado.getResponse().getStatus()).isEqualTo(200);
        String cuerpo = cuerpo(resultado);
        assertThat(JsonPath.read(cuerpo, "$.usuario.email").toString()).isEqualTo(EMAIL_TECNICO);
        assertThat(JsonPath.read(cuerpo, "$.usuario.nombre").toString()).isEqualTo("Diego Vargas");
        assertThat(JsonPath.read(cuerpo, "$.usuario.rol").toString()).isEqualTo("tecnico");
        assertThat(JsonPath.read(cuerpo, "$.usuario.tipoCliente").toString()).isEqualTo("persona");
        Object razonSocial = JsonPath.read(cuerpo, "$.usuario.razonSocial");
        Object nit = JsonPath.read(cuerpo, "$.usuario.nit");
        assertThat(razonSocial).isNull();
        assertThat(nit).isNull();
        Object expiraEn = JsonPath.read(cuerpo, "$.expiraEn");
        assertThat(expiraEn).isNotNull();
        assertThat(JsonPath.read(cuerpo, "$.token").toString()).isNotBlank();
    }

    @Test
    void el_token_devuelto_se_puede_verificar_y_lleva_los_datos_del_usuario() throws Exception {
        MvcResult resultado = login(EMAIL_TECNICO, CLAVE);
        String cuerpo = cuerpo(resultado);

        Jwt jwt = jwtDecoder.decode(JsonPath.read(cuerpo, "$.token"));

        Object id = JsonPath.read(cuerpo, "$.usuario.id");
        assertThat(jwt.getSubject()).isEqualTo(String.valueOf(id));
        assertThat(jwt.getClaimAsString("email")).isEqualTo(EMAIL_TECNICO);
        assertThat(jwt.getClaimAsString("rol")).isEqualTo("tecnico");
        assertThat(jwt.getClaimAsString("tipoCliente")).isEqualTo("persona");
        assertThat(jwt.getClaimAsString("nombre")).isEqualTo("Diego Vargas");
    }

    @Test
    void una_empresa_cliente_entra_con_rol_cliente_y_su_perfil_de_empresa() throws Exception {
        MvcResult resultado = login("contacto@ferreteria-lapaz.bo", CLAVE);

        assertThat(resultado.getResponse().getStatus()).isEqualTo(200);
        String cuerpo = cuerpo(resultado);

        assertThat(JsonPath.read(cuerpo, "$.usuario.rol").toString()).isEqualTo("cliente");
        assertThat(JsonPath.read(cuerpo, "$.usuario.tipoCliente").toString()).isEqualTo("empresa");
        assertThat(JsonPath.read(cuerpo, "$.usuario.nombre").toString())
                .isEqualTo("Ferretería La Paz S.R.L.");
        assertThat(JsonPath.read(cuerpo, "$.usuario.razonSocial").toString())
                .isEqualTo("Ferretería La Paz S.R.L.");
        assertThat(JsonPath.read(cuerpo, "$.usuario.nit").toString()).isEqualTo("1234567021");

        Jwt jwt = jwtDecoder.decode(JsonPath.read(cuerpo, "$.token"));
        assertThat(jwt.getClaimAsString("rol")).isEqualTo("cliente");
        assertThat(jwt.getClaimAsString("tipoCliente")).isEqualTo("empresa");
    }

    @Test
    void el_email_no_distingue_mayusculas() throws Exception {
        MvcResult resultado = login("DIEGO.VARGAS@EJEMPLO.BO", CLAVE);

        assertThat(resultado.getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void la_respuesta_nunca_expone_el_hash_de_la_contrasena() throws Exception {
        String cuerpo = cuerpo(login(EMAIL_TECNICO, CLAVE));

        assertThat(cuerpo).doesNotContain("passwordHash").doesNotContain("$2a$");
    }

    @Test
    void una_contrasena_incorrecta_es_credenciales_invalidas() throws Exception {
        mvc.perform(peticion(EMAIL_TECNICO, "clave-equivocada"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIALES_INVALIDAS"))
                .andExpect(jsonPath("$.mensaje").value("El email o la contraseña no son correctos."))
                .andExpect(jsonPath("$.campos").isEmpty());
    }

    @Test
    void un_email_inexistente_responde_exactamente_lo_mismo_que_una_mala_contrasena()
            throws Exception {
        String conMalaClave = cuerpo(login(EMAIL_TECNICO, "clave-equivocada"));
        String conEmailInexistente = cuerpo(login("nadie@fixly.bo", CLAVE));

        assertThat(conEmailInexistente).isEqualTo(conMalaClave);
    }

    @Test
    void una_cuenta_inactiva_con_la_clave_correcta_explica_el_motivo() throws Exception {
        crearUsuario("inactivo@prueba.bo", false, null);

        mvc.perform(peticion("inactivo@prueba.bo", CLAVE))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CUENTA_INACTIVA"))
                .andExpect(jsonPath("$.mensaje").value(
                        "Tu cuenta está inactiva. Contactá a soporte para reactivarla."));
    }

    @Test
    void una_cuenta_inactiva_con_la_clave_incorrecta_no_revela_su_estado() throws Exception {
        crearUsuario("inactivo2@prueba.bo", false, null);

        mvc.perform(peticion("inactivo2@prueba.bo", "clave-equivocada"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIALES_INVALIDAS"));
    }

    @Test
    void una_cuenta_eliminada_con_la_clave_correcta_tambien_explica_el_motivo() throws Exception {
        crearUsuario("eliminado@prueba.bo", true, OffsetDateTime.now());

        mvc.perform(peticion("eliminado@prueba.bo", CLAVE))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CUENTA_INACTIVA"));
    }

    @Test
    void sin_datos_responde_400_con_errores_por_campo() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"))
                .andExpect(jsonPath("$.campos").isNotEmpty());
    }

    @Test
    void un_email_sin_formato_responde_400() throws Exception {
        mvc.perform(peticion("no-es-un-email", CLAVE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    @Test
    void el_token_del_login_sirve_para_entrar_a_la_api_protegida() throws Exception {
        String token = JsonPath.read(cuerpo(login(EMAIL_TECNICO, CLAVE)), "$.token");

        // /api/auth/me exige token: 200 significa que la seguridad aceptó el
        // token emitido por el login.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void me_devuelve_los_datos_del_usuario_del_token() throws Exception {
        String cuerpoLogin = cuerpo(login(EMAIL_TECNICO, CLAVE));
        String token = JsonPath.read(cuerpoLogin, "$.token");
        Object id = JsonPath.read(cuerpoLogin, "$.usuario.id");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.nombre").value("Diego Vargas"))
                .andExpect(jsonPath("$.email").value(EMAIL_TECNICO))
                .andExpect(jsonPath("$.rol").value("tecnico"))
                .andExpect(jsonPath("$.tipoCliente").value("persona"))
                .andExpect(jsonPath("$.razonSocial").doesNotExist())
                .andExpect(jsonPath("$.nit").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void me_devuelve_el_perfil_de_empresa_recien_leido_de_la_base() throws Exception {
        String token = JsonPath.read(
                cuerpo(login("contacto@ferreteria-lapaz.bo", CLAVE)), "$.token");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rol").value("cliente"))
                .andExpect(jsonPath("$.tipoCliente").value("empresa"))
                .andExpect(jsonPath("$.nombre").value("Ferretería La Paz S.R.L."))
                .andExpect(jsonPath("$.razonSocial").value("Ferretería La Paz S.R.L."))
                .andExpect(jsonPath("$.nit").value("1234567021"));
    }

    @Test
    void me_corta_el_acceso_si_la_cuenta_fue_desactivada_despues_del_login() throws Exception {
        Usuario usuario = crearUsuario("se-desactiva@prueba.bo", true, null);
        String token = JsonPath.read(cuerpo(login("se-desactiva@prueba.bo", CLAVE)), "$.token");

        usuario.setActivo(false);
        usuarios.saveAndFlush(usuario);

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized())
                // El conversor corta ahora cualquier ruta protegida antes del controlador.
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    @Test
    void me_sin_token_responde_401() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTENTICADO"));
    }

    @Test
    void el_contexto_de_auditoria_queda_limpio_al_terminar_el_request() throws Exception {
        String token = JsonPath.read(cuerpo(login(EMAIL_TECNICO, CLAVE)), "$.token");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        assertThat(auditoria.usuarioActual()).isNull();
    }

    private MvcResult login(String email, String password) throws Exception {
        return mvc.perform(peticion(email, password)).andReturn();
    }

    private MockHttpServletRequestBuilder peticion(String email, String password) {
        return post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    private String cuerpo(MvcResult resultado) throws Exception {
        return resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private Usuario crearUsuario(String email, boolean activo, OffsetDateTime eliminadoEn) {
        Usuario usuario = new Usuario();
        usuario.setRol(RolUsuario.cliente);
        usuario.setNombre("Cuenta");
        usuario.setApellido("De Prueba");
        usuario.setEmail(email);
        usuario.setPasswordHash(passwordEncoder.encode(CLAVE));
        usuario.setActivo(activo);
        usuario.setEliminadoEn(eliminadoEn);
        return usuarios.save(usuario);
    }
}

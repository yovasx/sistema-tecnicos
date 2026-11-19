package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Alta pública de clientes (persona / empresa).
 *
 * <p>La clase es {@code @Transactional} para que cada registro se revierta al
 * terminar el test y no ensucie los seeds de V2.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RegistroControllerTest {

    private static final String CLAVE = "ClaveSegura2026!";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuarioRepository usuarios;

    @Test
    void una_persona_se_registra_y_el_token_sirve_para_me() throws Exception {
        MvcResult resultado = mvc.perform(peticion("""
                        {"nombre":"Ana","apellido":"Quispe","email":"ana.quispe@prueba.bo",
                         "telefono":"71234567","password":"%s","tipoCliente":"persona"}
                        """.formatted(CLAVE)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuario.email").value("ana.quispe@prueba.bo"))
                .andExpect(jsonPath("$.usuario.nombre").value("Ana Quispe"))
                .andExpect(jsonPath("$.usuario.rol").value("cliente"))
                .andExpect(jsonPath("$.usuario.tipoCliente").value("persona"))
                .andExpect(jsonPath("$.usuario.razonSocial").doesNotExist())
                .andExpect(jsonPath("$.usuario.nit").doesNotExist())
                .andReturn();

        String token = JsonPath.read(cuerpo(resultado), "$.token");
        assertThat(token).isNotBlank();

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ana.quispe@prueba.bo"))
                .andExpect(jsonPath("$.rol").value("cliente"))
                .andExpect(jsonPath("$.tipoCliente").value("persona"));
    }

    @Test
    void una_empresa_se_registra_con_razon_social_y_nit() throws Exception {
        mvc.perform(peticion("""
                        {"nombre":"Carlos","apellido":"Mendoza","email":"compras@norte.bo",
                         "telefono":"70011223","password":"%s","tipoCliente":"empresa",
                         "razonSocial":"Servicios Norte S.R.L.","nit":"7654321"}
                        """.formatted(CLAVE)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuario.rol").value("cliente"))
                .andExpect(jsonPath("$.usuario.tipoCliente").value("empresa"))
                .andExpect(jsonPath("$.usuario.nombre").value("Servicios Norte S.R.L."))
                .andExpect(jsonPath("$.usuario.razonSocial").value("Servicios Norte S.R.L."))
                .andExpect(jsonPath("$.usuario.nit").value("7654321"));
    }

    @Test
    void una_empresa_sin_nit_responde_400_y_no_crea_la_cuenta() throws Exception {
        mvc.perform(peticion("""
                        {"nombre":"Carlos","apellido":"Mendoza","email":"sin-nit@norte.bo",
                         "password":"%s","tipoCliente":"empresa",
                         "razonSocial":"Servicios Norte S.R.L."}
                        """.formatted(CLAVE)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_EMPRESA_INCOMPLETOS"));

        assertThat(usuarios.existsByEmailIgnoreCase("sin-nit@norte.bo")).isFalse();
    }

    @Test
    void un_email_ya_registrado_responde_409() throws Exception {
        mvc.perform(peticion("""
                        {"nombre":"Ana","apellido":"Quispe","email":"diego.vargas@ejemplo.bo",
                         "password":"%s","tipoCliente":"persona"}
                        """.formatted(CLAVE)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("EMAIL_YA_REGISTRADO"));
    }

    @Test
    void un_nit_ya_registrado_responde_409() throws Exception {
        mvc.perform(peticion("""
                        {"nombre":"Carlos","apellido":"Mendoza","email":"otro-nit@norte.bo",
                         "password":"%s","tipoCliente":"empresa",
                         "razonSocial":"Otra Empresa S.R.L.","nit":"1234567021"}
                        """.formatted(CLAVE)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("NIT_YA_REGISTRADO"));
    }

    @Test
    void el_rol_enviado_por_el_cliente_se_ignora_y_siempre_es_cliente() throws Exception {
        mvc.perform(peticion("""
                        {"nombre":"Mallory","apellido":"Prueba","email":"admin-falso@prueba.bo",
                         "password":"%s","tipoCliente":"persona","rol":"administrador"}
                        """.formatted(CLAVE)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuario.rol").value("cliente"));
    }

    @Test
    void una_contrasena_corta_responde_400_con_el_campo() throws Exception {
        mvc.perform(peticion("""
                        {"nombre":"Ana","apellido":"Quispe","email":"corta@prueba.bo",
                         "password":"1234","tipoCliente":"persona"}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"))
                .andExpect(jsonPath("$.campos[0].campo").value("password"));
    }

    @Test
    void el_email_se_guarda_normalizado_en_minusculas() throws Exception {
        mvc.perform(peticion("""
                        {"nombre":"Ana","apellido":"Quispe","email":"  ANA.MAYUS@PRUEBA.BO ",
                         "password":"%s","tipoCliente":"persona"}
                        """.formatted(CLAVE)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.usuario.email").value("ana.mayus@prueba.bo"));
    }

    @Test
    void el_registro_no_devuelve_el_hash_de_la_contrasena() throws Exception {
        MvcResult resultado = mvc.perform(peticion("""
                        {"nombre":"Ana","apellido":"Quispe","email":"hash@prueba.bo",
                         "password":"%s","tipoCliente":"persona"}
                        """.formatted(CLAVE)))
                .andExpect(status().isCreated())
                .andReturn();

        assertThat(cuerpo(resultado)).doesNotContain("passwordHash").doesNotContain("$2a$");
    }

    private MockHttpServletRequestBuilder peticion(String json) {
        return post("/api/auth/registro")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json);
    }

    private String cuerpo(MvcResult resultado) throws Exception {
        return resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }
}

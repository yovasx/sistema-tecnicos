package com.tecnicos.tecnicos_backend.admin.api;

import com.jayway.jsonpath.JsonPath;
import com.tecnicos.tecnicos_backend.shared.mail.ServicioEmail;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class InvitacionesAdminControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ServicioEmail correo;
    private static final String EMAIL="invitacion-usuario@prueba.bo";

    @Test void invitacion_no_expone_permiso_y_crea_cliente_solo_al_aceptar() throws Exception {
        String permiso=invitar("cliente");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity.usuarios WHERE email=?",Integer.class,EMAIL)).isZero();
        String almacenado=jdbc.queryForObject("SELECT permiso_hash FROM admin_svc.invitaciones_usuarios WHERE email=?",String.class,EMAIL);
        assertThat(almacenado).doesNotContain(permiso);
        aceptar(permiso).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT rol::text FROM identity.usuarios WHERE email=?",String.class,EMAIL)).isEqualTo("cliente");
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM admin_svc.auditoria_usuarios a JOIN identity.usuarios u ON u.id=a.usuario_id
            WHERE u.email=? AND a.accion='crear'
            """,Integer.class,EMAIL)).isEqualTo(1);
        aceptar(permiso).andExpect(status().isBadRequest());
    }
    @Test void invitacion_tecnica_no_aprueba_el_expediente() throws Exception {
        aceptar(invitar("tecnico")).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("""
            SELECT p.estado_validacion::text FROM identity.perfiles_tecnico p
            JOIN identity.usuarios u ON u.id=p.usuario_id WHERE u.email=?
            """,String.class,EMAIL)).isEqualTo("pendiente");
    }
    @Test void administrador_puede_invitar_otro_administrador_con_reautenticacion() throws Exception {
        aceptar(invitar("administrador")).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT rol::text FROM identity.usuarios WHERE email=?",String.class,EMAIL)).isEqualTo("administrador");
    }
    @Test void permiso_invalido_o_vencido_no_crea_cuentas() throws Exception {
        String permiso=invitar("cliente");
        aceptar("0".repeat(64)).andExpect(status().isBadRequest());
        jdbc.update("UPDATE admin_svc.invitaciones_usuarios SET expira_en=clock_timestamp()-INTERVAL '1 hour' WHERE email=?",EMAIL);
        aceptar(permiso).andExpect(status().isBadRequest());
    }
    @Test void password_administrativa_incorrecta_no_envia_correo() throws Exception {
        mvc.perform(post("/api/admin/usuarios/invitaciones").header("Authorization","Bearer "+admin())
            .contentType(MediaType.APPLICATION_JSON).content(datos("cliente","incorrecta")))
            .andExpect(status().isForbidden());
        verifyNoInteractions(correo);
    }
    @Test void smtp_fallido_no_promete_cuenta_creada() throws Exception {
        doThrow(new IllegalStateException("SMTP no disponible")).when(correo).enviarInvitacion(anyString(),anyString());
        mvc.perform(post("/api/admin/usuarios/invitaciones").header("Authorization","Bearer "+admin())
            .contentType(MediaType.APPLICATION_JSON).content(datos("cliente","Fixly2026!")))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.codigo").value("CORREO_NO_DISPONIBLE"));
    }
    private String invitar(String rol) throws Exception {
        var r=mvc.perform(post("/api/admin/usuarios/invitaciones").header("Authorization","Bearer "+admin())
            .contentType(MediaType.APPLICATION_JSON).content(datos(rol,"Fixly2026!")))
            .andExpect(status().isAccepted()).andReturn();
        assertThat(r.getResponse().getContentAsString()).isEmpty();
        var captor=ArgumentCaptor.forClass(String.class);
        verify(correo).enviarInvitacion(eq(EMAIL),captor.capture());
        return captor.getValue();
    }
    private ResultActions aceptar(String permiso) throws Exception {
        return mvc.perform(post("/api/auth/invitaciones/aceptar").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+EMAIL+"\",\"permiso\":\""+permiso+"\",\"password\":\"ClaveInvitado2026!\"}"));
    }
    private String datos(String rol,String password) {
        return """
            {"email":"%s","nombre":"Ana","apellido":"Prueba","rol":"%s","tipoCliente":"persona","passwordAdmin":"%s"}
            """.formatted(EMAIL,rol,password);
    }
    private String admin() throws Exception {
        var r=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"admin@fixly.bo\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(),"$.token");
    }
}

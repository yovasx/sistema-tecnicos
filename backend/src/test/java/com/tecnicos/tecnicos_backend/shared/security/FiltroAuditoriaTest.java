package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import javax.sql.DataSource;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * El filtro es el único punto que traduce "quién manda el token" a
 * {@code app.usuario_id}. Si no limpia, el ThreadLocal queda con el usuario
 * anterior y la auditoría registra a la persona equivocada.
 */
class FiltroAuditoriaTest {

    private final AuditoriaContexto auditoria =
            new AuditoriaContexto(mock(DataSource.class));
    private final FiltroAuditoria filtro = new FiltroAuditoria(auditoria);

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
        auditoria.limpiar();
    }

    @Test
    void publica_el_usuario_del_token_y_limpia_al_terminar() throws Exception {
        autenticar(7L);

        AtomicReference<Long> duranteElRequest = new AtomicReference<>();
        filtro.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
                (request, response) -> duranteElRequest.set(auditoria.usuarioActual()));

        assertThat(duranteElRequest.get()).isEqualTo(7L);
        assertThat(auditoria.usuarioActual()).isNull();
    }

    @Test
    void sin_autenticacion_no_inventa_usuario_y_igual_limpia() throws Exception {
        SecurityContextHolder.clearContext();

        AtomicReference<Long> duranteElRequest = new AtomicReference<>();
        filtro.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
                (request, response) -> duranteElRequest.set(auditoria.usuarioActual()));

        assertThat(duranteElRequest.get()).isNull();
        assertThat(auditoria.usuarioActual()).isNull();
    }

    @Test
    void un_principal_que_no_es_usuario_de_la_app_no_se_publica() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt(), "anonimo", List.of()));

        filtro.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
                (request, response) -> assertThat(auditoria.usuarioActual()).isNull());

        assertThat(auditoria.usuarioActual()).isNull();
    }

    @Test
    void limpia_aunque_el_resto_del_request_falle() {
        autenticar(7L);

        assertThatThrownBy(() -> filtro.doFilter(
                new MockHttpServletRequest(), new MockHttpServletResponse(),
                (request, response) -> {
                    throw new IllegalStateException("falló el controlador");
                }))
                .isInstanceOf(IllegalStateException.class);

        assertThat(auditoria.usuarioActual()).isNull();
    }

    private void autenticar(Long usuarioId) {
        UsuarioAutenticado usuario = new UsuarioAutenticado(
                usuarioId, RolUsuario.tecnico, TipoCliente.persona,
                "Carlos Mamani", "carlos@fixly.bo");
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt(), usuario, List.of(new SimpleGrantedAuthority("ROLE_TECNICO"))));
    }

    private Jwt jwt() {
        return Jwt.withTokenValue("token-de-prueba")
                .header("alg", "HS256")
                .subject("7")
                .claim("rol", "tecnico")
                .claim("tipoCliente", "persona")
                .claim("nombre", "Carlos Mamani")
                .claim("email", "carlos@fixly.bo")
                .build();
    }
}

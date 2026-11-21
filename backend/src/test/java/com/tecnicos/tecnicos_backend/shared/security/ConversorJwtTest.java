package com.tecnicos.tecnicos_backend.shared.security;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El conversor es el puente entre el token y las reglas de autorización: si
 * falla aquí, {@code hasRole("TECNICO")} deja de funcionar en todos lados.
 */
class ConversorJwtTest {

    private final VersionSesion versiones = org.mockito.Mockito.mock(VersionSesion.class);
    private final ConversorJwt conversor = new ConversorJwt(versiones);
    @org.junit.jupiter.api.BeforeEach void versiones() {
        org.mockito.Mockito.when(versiones.actual(org.mockito.ArgumentMatchers.anyLong())).thenReturn(0L);
    }

    @Test
    void un_tecnico_recibe_la_autoridad_role_tecnico_y_el_principal_tipado() {
        Jwt jwt = Jwt.withTokenValue("token-de-prueba")
                .header("alg", "HS256")
                .subject("7")
                .claim("rol", "tecnico")
                .claim("tipoCliente", "persona")
                .claim("nombre", "Carlos Mamani")
                .claim("email", "carlos@fixly.bo")
                .build();

        var autenticacion = conversor.convert(jwt);

        assertThat(autenticacion.getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_TECNICO");
        assertThat(autenticacion.getPrincipal()).isInstanceOf(UsuarioAutenticado.class);
        UsuarioAutenticado usuario = (UsuarioAutenticado) autenticacion.getPrincipal();
        assertThat(usuario.id()).isEqualTo(7L);
        assertThat(usuario.rol()).isEqualTo(RolUsuario.tecnico);
        assertThat(usuario.tipoCliente()).isEqualTo(TipoCliente.persona);
        assertThat(usuario.nombre()).isEqualTo("Carlos Mamani");
        assertThat(usuario.email()).isEqualTo("carlos@fixly.bo");
        assertThat(autenticacion.getName()).isEqualTo("carlos@fixly.bo");
    }

    @Test
    void cada_rol_produce_su_propia_autoridad() {
        assertThat(autoridadDe("cliente")).isEqualTo("ROLE_CLIENTE");
        assertThat(autoridadDe("administrador")).isEqualTo("ROLE_ADMINISTRADOR");
    }

    private String autoridadDe(String rol) {
        Jwt jwt = Jwt.withTokenValue("token-de-prueba")
                .header("alg", "HS256")
                .subject("1")
                .claim("rol", rol)
                .claim("tipoCliente", "persona")
                .claim("nombre", "Nombre Apellido")
                .claim("email", "usuario@fixly.bo")
                .build();
        return conversor.convert(jwt).getAuthorities().iterator().next().getAuthority();
    }
}

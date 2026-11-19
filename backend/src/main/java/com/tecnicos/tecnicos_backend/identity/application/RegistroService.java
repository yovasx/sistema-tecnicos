package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.identity.api.LoginResponse;
import com.tecnicos.tecnicos_backend.identity.api.RegistroRequest;
import com.tecnicos.tecnicos_backend.identity.api.UsuarioResumen;
import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.JwtService;
import com.tecnicos.tecnicos_backend.shared.security.TokenGenerado;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Alta pública de clientes.
 *
 * <p>La regla de negocio (rol fijo, perfil válido, datos de empresa completos)
 * vive en {@code identity.registrar_cliente}; acá solo se normalizan los datos,
 * se adelantan los duplicados con un mensaje útil y se emite la sesión para que
 * la persona entre directo después de registrarse.</p>
 */
@Service
public class RegistroService {

    private static final Logger log = LoggerFactory.getLogger(RegistroService.class);

    private final JdbcTemplate jdbc;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditoriaContexto auditoria;

    public RegistroService(JdbcTemplate jdbc, UsuarioRepository usuarios,
                           PasswordEncoder passwordEncoder, JwtService jwtService,
                           AuditoriaContexto auditoria) {
        this.jdbc = jdbc;
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditoria = auditoria;
    }

    @Transactional
    public LoginResponse registrar(RegistroRequest request) {
        auditoria.aplicarEnTransaccion();

        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (usuarios.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_YA_REGISTRADO",
                    "Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.");
        }

        String razonSocial = null;
        String nit = null;
        if (request.tipoCliente() == TipoCliente.empresa) {
            razonSocial = textoOLaNada(request.razonSocial());
            nit = textoOLaNada(request.nit());
            if (razonSocial == null || nit == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "DATOS_EMPRESA_INCOMPLETOS",
                        "Para una cuenta de empresa necesitamos la razón social y el NIT.");
            }
            if (usuarios.existsByNit(nit)) {
                throw new ApiException(HttpStatus.CONFLICT, "NIT_YA_REGISTRADO",
                        "Ya existe una cuenta con ese NIT. Iniciá sesión o contactá a soporte.");
            }
        }

        Long id = jdbc.queryForObject("""
                SELECT identity.registrar_cliente(?, ?, ?, ?, ?, ?, ?, ?)
                """, Long.class,
                request.nombre().trim(),
                request.apellido().trim(),
                email,
                textoOLaNada(request.telefono()),
                passwordEncoder.encode(request.password()),
                request.tipoCliente().name(),
                razonSocial,
                nit);

        Usuario usuario = usuarios.findById(id)
                .orElseThrow(() -> new IllegalStateException(
                        "La función de registro no devolvió un usuario existente."));

        TokenGenerado token = jwtService.generar(
                usuario.getId(), usuario.getRol(), usuario.getTipoCliente(),
                usuario.getNombreVisible(), usuario.getEmail());

        log.info("Registro de cliente: usuario {} con perfil {}", id, usuario.getTipoCliente());
        return new LoginResponse(token.token(), token.expiraEn(), UsuarioResumen.de(usuario));
    }

    private static String textoOLaNada(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }
}

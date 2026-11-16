package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.identity.api.LoginResponse;
import com.tecnicos.tecnicos_backend.identity.api.UsuarioResumen;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import com.tecnicos.tecnicos_backend.shared.security.JwtService;
import com.tecnicos.tecnicos_backend.shared.security.TokenGenerado;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Autenticación con email y contraseña.
 *
 * <p><b>Regla de oro</b>: no se enumera usuarios. Un email inexistente y una
 * contraseña incorrecta devuelven exactamente el mismo 401, y el estado de la
 * cuenta (inactiva/eliminada) solo se revela después de validar la contraseña.
 * Si se mirara {@code activo} antes, cualquiera podría descubrir cuentas dadas
 * de baja sin conocer la clave.</p>
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    /**
     * Hash BCrypt de relleno: cuando el email no existe igual se paga el costo
     * de una verificación, para que el tiempo de respuesta no delate si la
     * cuenta existe.
     */
    private static final String HASH_FANTASMA =
            "$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG";

    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarios, PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(String email, String password) {
        String emailLimpio = email == null ? "" : email.trim();
        String clave = password == null ? "" : password;

        Optional<Usuario> encontrado = usuarios.findByEmailIgnoreCase(emailLimpio);
        if (encontrado.isEmpty()) {
            passwordEncoder.matches(clave, HASH_FANTASMA);
            throw credencialesInvalidas();
        }

        Usuario usuario = encontrado.get();
        if (!passwordEncoder.matches(clave, usuario.getPasswordHash())) {
            throw credencialesInvalidas();
        }

        // Recién con la contraseña correcta se puede contar el estado de la cuenta.
        if (!usuario.isActivo() || usuario.isEliminado()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "CUENTA_INACTIVA",
                    "Tu cuenta está inactiva. Contactá a soporte para reactivarla.");
        }

        TokenGenerado token = jwtService.generar(
                usuario.getId(), usuario.getRol(), usuario.getNombreCompleto(), usuario.getEmail());

        log.info("Login correcto: usuario {} con rol {}", usuario.getId(), usuario.getRol());
        return new LoginResponse(token.token(), token.expiraEn(), UsuarioResumen.de(usuario));
    }

    private ApiException credencialesInvalidas() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "CREDENCIALES_INVALIDAS",
                "El email o la contraseña no son correctos.");
    }
}

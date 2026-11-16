package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.AuthService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * La ruta está abierta en {@code SecurityConfig}; el token que devuelve es
     * el que la app manda como {@code Authorization: Bearer ...}.
     */
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request.email(), request.password());
    }

    /**
     * Sesión actual. Los datos salen del token ya verificado, sin volver a la
     * base: el JWT es la sesión y vence a los 30 minutos. Si una cuenta se
     * desactiva, el token deja de servir al vencer (no hay lista de revocación
     * todavía).
     */
    @GetMapping("/me")
    public UsuarioResumen me(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        if (usuario == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "NO_AUTENTICADO",
                    "Necesitás iniciar sesión.");
        }
        return new UsuarioResumen(usuario.id(), usuario.nombre(), usuario.email(), usuario.rol());
    }
}

package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.AuthService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
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
     * Sesión actual. Se vuelve a la base para devolver el perfil fresco
     * ({@code tipoCliente}, razón social, NIT) y para cortar el acceso si la
     * cuenta fue desactivada después de emitir el token.
     */
    @GetMapping("/me")
    public UsuarioResumen me(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return authService.sesion(usuario.id());
    }
}

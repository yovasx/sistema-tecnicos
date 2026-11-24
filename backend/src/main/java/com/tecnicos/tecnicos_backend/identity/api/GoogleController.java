package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.GoogleService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/google")
public class GoogleController {
    private final GoogleService servicio;
    public GoogleController(GoogleService servicio) { this.servicio=servicio; }
    public enum Proposito { acceso, cliente, tecnico, vinculacion }
    public record SolicitudDesafio(Proposito proposito) {}
    public record Desafio(String nonce) {}
    public record Acceso(@NotBlank @Size(max=16000) String idToken,
                         @NotBlank @Pattern(regexp="[a-f0-9]{64}") String nonce,
                         @Size(max=100) String nombre,@Size(max=100) String apellido) {}
    public record Vinculacion(@NotBlank @Size(max=16000) String idToken,
        @NotBlank @Pattern(regexp="[a-f0-9]{64}") String nonce,@NotBlank @Size(max=72) String password) {}
    @PostMapping("/desafio")
    public ResponseEntity<Desafio> desafio(@Valid @RequestBody(required=false) SolicitudDesafio r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(new Desafio(servicio.desafio(r==null || r.proposito()==null?Proposito.acceso:r.proposito())));
    }
    @PostMapping
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody Acceso r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(servicio.login(r.idToken(),r.nonce(),r.nombre(),r.apellido()));
    }
    @PostMapping("/vincular")
    public void vincular(@org.springframework.security.core.annotation.AuthenticationPrincipal
                         com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado usuario,
                         @Valid @RequestBody Vinculacion r) {
        servicio.vincular(usuario.id(),r.idToken(),r.nonce(),r.password());
    }
}

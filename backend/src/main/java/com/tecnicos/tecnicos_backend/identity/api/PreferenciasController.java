package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.PreferenciasService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/perfil/preferencias")
public class PreferenciasController {
    private final PreferenciasService servicio;
    public PreferenciasController(PreferenciasService servicio) { this.servicio=servicio; }
    @GetMapping public ResponseEntity<?> propio(@AuthenticationPrincipal UsuarioAutenticado u) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.propio(u.id()));
    }
    @PutMapping public ResponseEntity<?> guardar(@AuthenticationPrincipal UsuarioAutenticado u,@Valid @RequestBody PreferenciasService.Editar r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.guardar(u.id(),r));
    }
}

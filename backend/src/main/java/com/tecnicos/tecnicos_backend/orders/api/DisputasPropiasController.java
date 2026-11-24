package com.tecnicos.tecnicos_backend.orders.api;

import com.tecnicos.tecnicos_backend.orders.application.DisputasService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Disputas vistas por sus participantes (cliente o técnico). */
@RestController
@RequestMapping("/api/disputas")
public class DisputasPropiasController {
    private final DisputasService servicio;
    public DisputasPropiasController(DisputasService servicio) { this.servicio = servicio; }

    @PostMapping
    public ResponseEntity<?> abrir(@AuthenticationPrincipal UsuarioAutenticado u,
                                   @Valid @RequestBody DisputasDtos.Nueva datos) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(Map.of("id", servicio.abrir(u, datos)));
    }

    @GetMapping
    public ResponseEntity<?> propias(@AuthenticationPrincipal UsuarioAutenticado u,
                                     @RequestParam(defaultValue = "0") int pagina) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(servicio.propias(u.id(), pagina));
    }
}

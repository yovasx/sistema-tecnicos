package com.tecnicos.tecnicos_backend.reputation.api;

import com.tecnicos.tecnicos_backend.reputation.application.ReputacionService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Reputación y calificaciones.
 *
 * <p>El cliente califica desde {@code /api/ordenes}; el técnico desde
 * {@code /api/tecnicos/ordenes}. En los dos casos la base decide el
 * destinatario a partir de la orden, no el cuerpo de la petición.</p>
 */
@RestController
public class ReputacionController {

    private final ReputacionService servicio;

    public ReputacionController(ReputacionService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/api/perfil/reputacion")
    public ResponseEntity<ReputacionDtos.Resumen> propio(
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(servicio.propio(usuario));
    }

    @PostMapping("/api/ordenes/{id}/calificacion")
    public ResponseEntity<ReputacionDtos.Creada> calificar(@PathVariable long id,
            @Valid @RequestBody ReputacionDtos.Calificar datos) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
            .body(servicio.calificar(id, datos));
    }

    @PostMapping("/api/tecnicos/ordenes/{id}/calificacion")
    public ResponseEntity<ReputacionDtos.Creada> calificarTecnico(@PathVariable long id,
            @Valid @RequestBody ReputacionDtos.Calificar datos) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
            .body(servicio.calificar(id, datos));
    }
}

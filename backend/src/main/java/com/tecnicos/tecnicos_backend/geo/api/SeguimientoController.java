package com.tecnicos.tecnicos_backend.geo.api;

import com.tecnicos.tecnicos_backend.geo.application.SeguimientoService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

@RestController
public class SeguimientoController {
    private final SeguimientoService servicio;
    public SeguimientoController(SeguimientoService servicio) { this.servicio=servicio; }
    public record Ubicacion(@NotNull(message="Indica la orden.") Long orden,
        @NotNull(message="Indica la latitud.") Double latitud,
        @NotNull(message="Indica la longitud.") Double longitud, Float precision) {}
    @GetMapping("/api/ordenes/{id}/seguimiento")
    public ResponseEntity<SeguimientoService.Vista> consultar(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.consultar(u.id(),id));
    }
    @PostMapping("/api/ordenes/{id}/seguimiento/ticket")
    public ResponseEntity<SeguimientoService.Ticket> ticket(@AuthenticationPrincipal UsuarioAutenticado u,
        @PathVariable long id, JwtAuthenticationToken autenticacion) {
        Object version=autenticacion.getToken().getClaims().get("versionSesion");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(servicio.emitir(u.id(),id,autenticacion.getToken().getExpiresAt(),
                version instanceof Number n?n.longValue():0L));
    }
    @PostMapping("/api/tecnicos/ubicacion")
    public ResponseEntity<Void> ubicacion(@AuthenticationPrincipal UsuarioAutenticado u,@Valid @RequestBody Ubicacion r) {
        servicio.reportar(u.id(),r.orden(),r.latitud(),r.longitud(),r.precision());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}

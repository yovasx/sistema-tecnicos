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
    public record Ubicacion(@NotNull(message="Inicia una sesión GPS.") java.util.UUID sesion,
        @NotNull(message="Indica la latitud.") Double latitud,
        @NotNull(message="Indica la longitud.") Double longitud,
        @NotNull(message="Indica la precisión.") Float precision,
        @NotNull(message="Indica cuándo se capturó la ubicación.") java.time.OffsetDateTime capturadoEn) {}
    public record IniciarGps(@NotNull(message="Indica la plataforma.") String plataforma,
        @NotNull(message="Confirma el modo de seguimiento.") Boolean segundoPlano) {}
    public record IniciarGpsCliente(@NotNull(message="Indica la plataforma.") String plataforma) {}
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
    @PostMapping("/api/ordenes/{id}/seguimiento/gps")
    public ResponseEntity<SeguimientoService.SesionGpsCliente> iniciarGpsCliente(@PathVariable long id,
        @Valid @RequestBody IniciarGpsCliente r,JwtAuthenticationToken autenticacion) {
        Object version=autenticacion.getToken().getClaims().get("versionSesion");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.iniciarGpsCliente(id,
            r.plataforma(),version instanceof Number n?n.longValue():0L,autenticacion.getToken().getExpiresAt()));
    }
    @PostMapping("/api/ordenes/seguimiento/ubicacion")
    public ResponseEntity<Void> ubicacionCliente(@Valid @RequestBody Ubicacion r) {
        servicio.reportarGpsCliente(r.sesion(),r.latitud(),r.longitud(),r.precision(),r.capturadoEn());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @DeleteMapping("/api/ordenes/seguimiento/gps/{sesion}")
    public ResponseEntity<Void> detenerGpsCliente(@PathVariable java.util.UUID sesion) {
        servicio.detenerGpsCliente(sesion);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @PostMapping("/api/tecnicos/ubicacion")
    public ResponseEntity<Void> ubicacion(@AuthenticationPrincipal UsuarioAutenticado u,@Valid @RequestBody Ubicacion r) {
        servicio.reportarGps(r.sesion(),r.latitud(),r.longitud(),r.precision(),r.capturadoEn());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @PostMapping("/api/tecnicos/servicios/{id}/gps")
    public ResponseEntity<?> iniciarGps(@PathVariable long id,@Valid @RequestBody IniciarGps r,JwtAuthenticationToken autenticacion) {
        Object version=autenticacion.getToken().getClaims().get("versionSesion");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.iniciarGps(id,
            r.plataforma(),r.segundoPlano(),version instanceof Number n?n.longValue():0L,autenticacion.getToken().getExpiresAt()));
    }
    @DeleteMapping("/api/tecnicos/gps/{sesion}")
    public ResponseEntity<Void> detenerGps(@PathVariable java.util.UUID sesion) {
        servicio.detenerGps(sesion);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}

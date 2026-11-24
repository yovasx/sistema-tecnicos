package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.RecuperacionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth/recuperacion")
public class RecuperacionController {
    private final RecuperacionService servicio;
    public RecuperacionController(RecuperacionService servicio) { this.servicio=servicio; }
    public record Solicitud(@NotBlank @Email @Size(max=150) String email) {}
    public record Confirmacion(@NotNull UUID solicitudId,@NotBlank @Pattern(regexp="[0-9]{6}") String codigo) {}
    public record Restablecer(@NotNull UUID solicitudId,@NotBlank @Size(max=100) String permiso,
                              @NotBlank @Size(min=8,max=72) String password) {}
    public record Solicitado(UUID solicitudId,String mensaje) {}
    public record Confirmado(String permiso) {}
    @PostMapping("/solicitar")
    public ResponseEntity<Solicitado> solicitar(@Valid @RequestBody Solicitud r) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore()).body(
            new Solicitado(servicio.solicitar(r.email()),
                "Si existe una cuenta con contraseña para ese correo y no alcanzaste el límite, recibirás un código. Revisa tu bandeja."));
    }
    @PostMapping("/confirmar")
    public ResponseEntity<Confirmado> confirmar(@Valid @RequestBody Confirmacion r) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
            .body(new Confirmado(servicio.confirmar(r.solicitudId(),r.codigo())));
    }
    @PostMapping("/restablecer")
    public void restablecer(@Valid @RequestBody Restablecer r) {
        servicio.restablecer(r.solicitudId(),r.permiso(),r.password());
    }
}

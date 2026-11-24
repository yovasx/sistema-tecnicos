package com.tecnicos.tecnicos_backend.chat.api;

import com.tecnicos.tecnicos_backend.chat.application.ComunicacionService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
public class ComunicacionController {
    private final ComunicacionService servicio;
    public ComunicacionController(ComunicacionService servicio) { this.servicio=servicio; }
    public record NuevoMensaje(@NotNull(message="La clave del mensaje no es válida.") UUID clave,
        @NotBlank(message="Escribe un mensaje.") @Size(max=2000,message="Usa hasta 2000 caracteres.") String contenido) {}
    @GetMapping("/api/notificaciones") public ResponseEntity<?> notificaciones(@AuthenticationPrincipal UsuarioAutenticado u,
        @RequestParam(defaultValue="0") int pagina) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.notificaciones(u.id(),pagina)); }
    @PatchMapping("/api/notificaciones/{id}/leer") public ResponseEntity<Void> leer(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) {
        servicio.leer(u.id(),id); return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @GetMapping("/api/servicios/{id}/mensajes") public ResponseEntity<?> mensajes(@AuthenticationPrincipal UsuarioAutenticado u,
        @PathVariable long id,@RequestParam(defaultValue="0") long antes) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.mensajes(u.id(),id,antes));
    }
    @PostMapping("/api/servicios/{id}/mensajes") public ResponseEntity<?> enviar(@PathVariable long id,@Valid @RequestBody NuevoMensaje r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(java.util.Map.of("id",servicio.enviar(id,r.clave(),r.contenido())));
    }
}

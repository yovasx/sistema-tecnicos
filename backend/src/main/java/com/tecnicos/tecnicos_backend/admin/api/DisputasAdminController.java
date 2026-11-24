package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.orders.api.DisputasDtos;
import com.tecnicos.tecnicos_backend.orders.application.DisputasService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Cola y resolución de disputas del backoffice. */
@RestController
@RequestMapping("/api/admin/disputas")
public class DisputasAdminController {
    private final DisputasService servicio;
    public DisputasAdminController(DisputasService servicio) { this.servicio = servicio; }

    @GetMapping
    public ResponseEntity<?> listar(@RequestParam(required = false) String estado,
                                    @RequestParam(defaultValue = "0") int pagina) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(servicio.administracion(estado, pagina));
    }

    @PostMapping("/{id}/revisar")
    public ResponseEntity<?> revisar(@AuthenticationPrincipal UsuarioAutenticado u,
                                     @PathVariable long id,
                                     @Valid @RequestBody DisputasDtos.Revision datos) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(Map.of("estado", servicio.revisar(u, id, datos)));
    }
}

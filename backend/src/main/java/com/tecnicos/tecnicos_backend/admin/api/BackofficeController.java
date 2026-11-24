package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.application.BackofficeService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/** Backoffice operativo: auditoría, moderación, notificaciones, liquidaciones, mapa y reportes. */
@RestController
@RequestMapping("/api/admin")
public class BackofficeController {
    private final BackofficeService servicio;
    public BackofficeController(BackofficeService servicio) { this.servicio = servicio; }

    private <T> ResponseEntity<T> ok(T datos) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(datos);
    }

    @GetMapping("/resumen-operativo")
    public ResponseEntity<?> resumen() { return ok(servicio.resumen()); }

    @GetMapping("/auditoria")
    public ResponseEntity<?> auditoria(@RequestParam(required = false) String origen,
                                       @RequestParam(defaultValue = "0") int pagina) {
        return ok(servicio.auditoria(origen, pagina));
    }

    @GetMapping("/moderacion")
    public ResponseEntity<?> moderacion(@RequestParam(defaultValue = "true") boolean pendientes,
                                        @RequestParam(defaultValue = "0") int pagina) {
        return ok(servicio.moderacion(pendientes, pagina));
    }

    @PostMapping("/moderacion/{id}/revisar")
    public ResponseEntity<Void> revisar(@AuthenticationPrincipal UsuarioAutenticado u, @PathVariable long id,
                                        @Valid @RequestBody BackofficeDtos.RevisionMensaje datos) {
        servicio.revisarMensaje(u, id, datos);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/notificaciones")
    public ResponseEntity<?> notificaciones(@RequestParam(required = false) String tipo,
                                            @RequestParam(defaultValue = "0") int pagina) {
        return ok(servicio.notificaciones(tipo, pagina));
    }

    @GetMapping("/liquidaciones")
    public ResponseEntity<?> liquidaciones(@RequestParam(required = false) String estado,
                                           @RequestParam(defaultValue = "0") int pagina) {
        return ok(servicio.liquidaciones(estado, pagina));
    }

    @GetMapping("/mapa")
    public ResponseEntity<?> mapa() { return ok(servicio.mapa()); }

    @GetMapping(value = "/reportes/ordenes.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<byte[]> reporte(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        String csv = servicio.reporteOrdenes(desde, hasta);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"ordenes.csv\"")
            .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
            .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}

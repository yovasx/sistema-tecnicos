package com.tecnicos.tecnicos_backend.orders.api;

import com.tecnicos.tecnicos_backend.orders.application.AtencionService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;

@RestController
public class AtencionController {
    private final AtencionService servicio;
    public AtencionController(AtencionService servicio) { this.servicio=servicio; }
    private <T> ResponseEntity<T> ok(T r) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(r); }
    private ResponseEntity<Void> vacio() { return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build(); }
    @GetMapping("/api/servicios/{id}/atencion")
    public ResponseEntity<?> consultar(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) { return ok(servicio.consultar(u,id)); }
    @PostMapping("/api/servicios/{id}/atencion/codigo")
    public ResponseEntity<?> codigo(@PathVariable long id) { return ok(Map.of("codigo",servicio.codigo(id),"vigenciaMinutos",10)); }
    @PostMapping("/api/servicios/{id}/atencion/llegada")
    public ResponseEntity<Void> llegada(@PathVariable long id,@Valid @RequestBody AtencionDtos.Codigo r) { servicio.llegada(id,r.codigo()); return vacio(); }
    @PostMapping("/api/servicios/{id}/atencion/incidencia")
    public ResponseEntity<Void> incidencia(@PathVariable long id,@Valid @RequestBody AtencionDtos.Accion r) { servicio.incidencia(id,r); return vacio(); }
    @PostMapping("/api/servicios/{id}/atencion/reintentar")
    public ResponseEntity<Void> reintentar(@PathVariable long id,@Valid @RequestBody AtencionDtos.Revision r) { servicio.reintentar(id,r.revision()); return vacio(); }
    @PostMapping(value="/api/servicios/{id}/atencion/entrega",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> entregar(@PathVariable long id,@RequestParam long revision,@RequestParam String trabajo,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate mantenimiento,
        @RequestParam MultipartFile evidencia) throws IOException {
        servicio.entregar(id,revision,trabajo,mantenimiento,evidencia); return vacio();
    }
    @PostMapping("/api/servicios/{id}/atencion/conformidad")
    public ResponseEntity<Void> conformidad(@PathVariable long id,@Valid @RequestBody AtencionDtos.Conformidad r) { servicio.conformidad(id,r); return vacio(); }
    @GetMapping("/api/servicios/{id}/atencion/evidencia")
    public ResponseEntity<InputStreamResource> evidencia(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) throws IOException {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"evidencia-trabajo.bin\"")
            .contentType(MediaType.APPLICATION_OCTET_STREAM).body(new InputStreamResource(servicio.evidencia(u,id)));
    }
    @PostMapping("/api/admin/operacion/{id}/resolver")
    public ResponseEntity<Void> resolver(@PathVariable long id,@Valid @RequestBody AtencionDtos.Accion r) { servicio.resolver(id,r); return vacio(); }
    @GetMapping("/api/admin/operacion/{id}/candidatos")
    public ResponseEntity<?> candidatos(@PathVariable long id) { return ok(servicio.candidatos(id)); }
}

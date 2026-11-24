package com.tecnicos.tecnicos_backend.geo.api;

import com.tecnicos.tecnicos_backend.geo.application.CoberturaService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class CoberturaController {
    private final CoberturaService servicio;
    public CoberturaController(CoberturaService servicio) { this.servicio=servicio; }
    private <T> ResponseEntity<T> ok(T datos) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(datos); }
    private ResponseEntity<Void> vacio() { return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build(); }
    @GetMapping("/api/tecnicos/cobertura")
    public ResponseEntity<?> propia(@AuthenticationPrincipal UsuarioAutenticado u,@RequestParam(defaultValue="0") int pagina) {
        return ok(servicio.consultar(u.id(),pagina,false));
    }
    @PostMapping("/api/tecnicos/cobertura/propuestas")
    public ResponseEntity<?> proponer(@Valid @RequestBody CoberturaDtos.Propuesta r) { return ok(Map.of("id",servicio.proponer(r))); }
    @PostMapping("/api/tecnicos/cobertura/propuestas/{id}/retirar")
    public ResponseEntity<Void> retirar(@PathVariable long id) { servicio.retirar(id); return vacio(); }
    @PostMapping("/api/tecnicos/cobertura/comprobar")
    public ResponseEntity<?> comprobar(@AuthenticationPrincipal UsuarioAutenticado u,@Valid @RequestBody CoberturaDtos.Punto r) {
        return ok(servicio.comprobar(u.id(),r));
    }
    @GetMapping("/api/admin/coberturas")
    public ResponseEntity<?> pendientes(@RequestParam(defaultValue="0") int pagina) { return ok(servicio.pendientes(pagina)); }
    @GetMapping("/api/admin/tecnicos/{id}/cobertura")
    public ResponseEntity<?> ficha(@PathVariable long id,@RequestParam(defaultValue="0") int pagina) { return ok(servicio.consultar(id,pagina,true)); }
    @PostMapping("/api/admin/coberturas/{id}/revisar")
    public ResponseEntity<Void> revisar(@PathVariable long id,@Valid @RequestBody CoberturaDtos.Decision r) {
        servicio.revisar(id,r); return vacio();
    }
}

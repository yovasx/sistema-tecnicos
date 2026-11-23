package com.tecnicos.tecnicos_backend.orders.api;

import com.tecnicos.tecnicos_backend.orders.application.OperacionService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class OperacionController {
    private final OperacionService servicio;
    public OperacionController(OperacionService servicio) { this.servicio=servicio; }
    private <T> ResponseEntity<T> ok(T datos) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(datos); }
    private ResponseEntity<Void> vacio() { return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build(); }
    @GetMapping("/api/tecnicos/panel") public ResponseEntity<?> panel(@AuthenticationPrincipal UsuarioAutenticado u) { return ok(servicio.panel(u.id())); }
    @GetMapping("/api/tecnicos/servicios") public ResponseEntity<?> servicios(@AuthenticationPrincipal UsuarioAutenticado u,@RequestParam(defaultValue="0") int pagina) { return ok(servicio.servicios(u.id(),pagina)); }
    @GetMapping("/api/tecnicos/servicios/{id}") public ResponseEntity<?> detalle(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) { return ok(servicio.detalle(u.id(),id)); }
    @PutMapping("/api/tecnicos/disponibilidad") public ResponseEntity<Void> disponibilidad(@Valid @RequestBody OperacionDtos.Disponibilidad r) { servicio.disponibilidad(r.disponible()); return vacio(); }
    @PostMapping("/api/tecnicos/servicios/{id}/aceptar") public ResponseEntity<Void> aceptar(@PathVariable long id) { servicio.tomar(id); return vacio(); }
    @PostMapping("/api/tecnicos/ofertas/{id}/aceptar")
    public ResponseEntity<Void> aceptarOferta(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) { servicio.aceptarOferta(u.id(),id); return vacio(); }
    @PostMapping("/api/tecnicos/ofertas/{id}/rechazar")
    public ResponseEntity<Void> rechazarOferta(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) { servicio.rechazarOferta(u.id(),id); return vacio(); }
    @PostMapping("/api/tecnicos/servicios/{id}/llegada") public ResponseEntity<Void> llegada(@PathVariable long id) { servicio.avanzar(id,"llegada"); return vacio(); }
    @PostMapping("/api/tecnicos/servicios/{id}/reparacion") public ResponseEntity<Void> reparar(@PathVariable long id) { servicio.avanzar(id,"reparacion"); return vacio(); }
    @PostMapping("/api/tecnicos/servicios/{id}/finalizar") public ResponseEntity<Void> finalizar(@PathVariable long id) { servicio.avanzar(id,"finalizar"); return vacio(); }
    @PostMapping("/api/ordenes/{id}/cancelar") public ResponseEntity<Void> cancelar(@PathVariable long id,@Valid @RequestBody OperacionDtos.Motivo r) { servicio.cancelar(id,r.motivo()); return vacio(); }
    @GetMapping({"/api/ordenes/{id}/cotizaciones","/api/tecnicos/servicios/{id}/cotizaciones"})
    public ResponseEntity<?> cotizaciones(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) { return ok(servicio.cotizaciones(u,id)); }
    @PostMapping("/api/tecnicos/servicios/{id}/cotizaciones") public ResponseEntity<?> cotizar(@PathVariable long id,@Valid @RequestBody OperacionDtos.NuevaCotizacion r) { return ok(java.util.Map.of("id",servicio.cotizar(id,r))); }
    @PostMapping("/api/ordenes/{id}/cotizaciones/{cotizacion}/responder")
    public ResponseEntity<?> responder(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id,@PathVariable long cotizacion,@Valid @RequestBody OperacionDtos.Respuesta r) { return ok(java.util.Map.of("estado",servicio.responder(u,id,cotizacion,r))); }
    @GetMapping("/api/tecnicos/liquidaciones") public ResponseEntity<?> liquidaciones(@AuthenticationPrincipal UsuarioAutenticado u,@RequestParam(defaultValue="0") int pagina) { return ok(servicio.liquidaciones(u.id(),pagina)); }
}

package com.tecnicos.tecnicos_backend.orders.api;

import com.tecnicos.tecnicos_backend.orders.application.EquiposService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class EquiposController {
    public record EquipoDatos(@PositiveOrZero Long revision,Long sucursal,
        @NotBlank @Size(min=2,max=100) String nombre,@Size(max=100) String marca,
        @Size(max=100) String modelo,@Size(max=100) String identificador,@NotNull Boolean activo) {}
    public record SucursalDatos(@PositiveOrZero Long revision,@NotBlank @Size(min=2,max=100) String nombre,
        @NotBlank @Size(min=5,max=300) String referencia,@NotNull Boolean activa) {}
    private final EquiposService servicio;
    public EquiposController(EquiposService servicio) { this.servicio=servicio; }
    private <T> ResponseEntity<T> ok(T r) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(r); }
    @GetMapping("/api/equipos") public ResponseEntity<?> equipos(@AuthenticationPrincipal UsuarioAutenticado u) { return ok(servicio.equipos(u.id())); }
    @PostMapping("/api/equipos") public ResponseEntity<?> crear(@Valid @RequestBody EquipoDatos r) { return ok(servicio.guardar(null,r)); }
    @PutMapping("/api/equipos/{id}") public ResponseEntity<?> editar(@PathVariable long id,@Valid @RequestBody EquipoDatos r) { return ok(servicio.guardar(id,r)); }
    @GetMapping("/api/equipos/{id}/historial") public ResponseEntity<?> historial(@AuthenticationPrincipal UsuarioAutenticado u,@PathVariable long id) { return ok(servicio.historial(u.id(),id)); }
    @GetMapping("/api/sucursales") public ResponseEntity<?> sucursales(@AuthenticationPrincipal UsuarioAutenticado u) { return ok(servicio.sucursales(u.id())); }
    @PostMapping("/api/sucursales") public ResponseEntity<?> crearSucursal(@Valid @RequestBody SucursalDatos r) { return ok(servicio.guardarSucursal(null,r)); }
    @PutMapping("/api/sucursales/{id}") public ResponseEntity<?> editarSucursal(@PathVariable long id,@Valid @RequestBody SucursalDatos r) { return ok(servicio.guardarSucursal(id,r)); }
}

package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.DireccionesService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Direcciones del propio cliente; el dueño siempre sale del JWT. */
@RestController
@RequestMapping("/api/perfil/direcciones")
public class DireccionesController {

    private final DireccionesService servicio;

    public DireccionesController(DireccionesService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public ResponseEntity<List<DireccionesDtos.Fila>> listar(
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(servicio.listar(usuario.id()));
    }

    @PostMapping
    public ResponseEntity<DireccionesDtos.Fila> crear(
            @AuthenticationPrincipal UsuarioAutenticado usuario,
            @Valid @RequestBody DireccionesDtos.Guardar datos) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
            .body(servicio.guardar(usuario.id(), null, datos));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DireccionesDtos.Fila> editar(
            @AuthenticationPrincipal UsuarioAutenticado usuario, @PathVariable long id,
            @Valid @RequestBody DireccionesDtos.Guardar datos) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(servicio.guardar(usuario.id(), id, datos));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(
            @AuthenticationPrincipal UsuarioAutenticado usuario, @PathVariable long id) {
        servicio.eliminar(usuario.id(), id);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}

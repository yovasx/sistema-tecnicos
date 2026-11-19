package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.application.UsuariosAdminService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** El destinatario siempre es el administrador autenticado, nunca un id del cuerpo. */
@RestController
@RequestMapping("/api/admin/perfil")
public class PerfilAdminController {
    private final UsuariosAdminService usuarios;

    public PerfilAdminController(UsuariosAdminService usuarios) { this.usuarios = usuarios; }

    @GetMapping
    public ResponseEntity<UsuariosAdminDtos.Detalle> propio(@AuthenticationPrincipal UsuarioAutenticado admin) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(usuarios.detalle(admin.id()));
    }

    @PutMapping
    public ResponseEntity<UsuariosAdminDtos.Detalle> guardar(
            @AuthenticationPrincipal UsuarioAutenticado admin, @Valid @RequestBody PerfilAdminEditar datos) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(usuarios.editarPerfil(admin.id(), datos));
    }
}

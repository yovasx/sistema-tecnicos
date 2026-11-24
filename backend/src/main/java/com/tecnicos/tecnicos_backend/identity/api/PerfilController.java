package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.identity.application.FotoPerfilService;
import com.tecnicos.tecnicos_backend.identity.application.PerfilService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** El destinatario siempre sale del JWT; no hay identificador elegible por el cliente. */
@RestController
@RequestMapping("/api/perfil")
public class PerfilController {
    private final PerfilService servicio;
    private final FotoPerfilService fotos;
    public PerfilController(PerfilService servicio, FotoPerfilService fotos) {
        this.servicio=servicio; this.fotos=fotos;
    }
    @GetMapping
    public ResponseEntity<PerfilDtos.Detalle> propio(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.propio(usuario.id()));
    }
    @PutMapping
    public ResponseEntity<PerfilDtos.Detalle> editar(@AuthenticationPrincipal UsuarioAutenticado usuario,
        @Valid @RequestBody PerfilDtos.Editar r) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.editar(usuario.id(),r));
    }
    @PostMapping(value="/foto", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PerfilDtos.Detalle> foto(@AuthenticationPrincipal UsuarioAutenticado usuario,
        @RequestParam("archivo") MultipartFile archivo) throws IOException {
        fotos.guardar(usuario.id(), archivo);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.propio(usuario.id()));
    }
    @DeleteMapping("/foto")
    public ResponseEntity<PerfilDtos.Detalle> quitarFoto(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        fotos.quitar(usuario.id());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.propio(usuario.id()));
    }
    @PostMapping("/password")
    public ResponseEntity<Void> password(@AuthenticationPrincipal UsuarioAutenticado usuario,
        @Valid @RequestBody PerfilDtos.Password r) {
        servicio.password(usuario.id(),r);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}

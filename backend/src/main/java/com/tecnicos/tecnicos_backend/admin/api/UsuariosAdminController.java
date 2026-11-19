package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.api.UsuariosAdminDtos.*;
import com.tecnicos.tecnicos_backend.admin.application.UsuariosAdminService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/usuarios")
public class UsuariosAdminController {
    private final UsuariosAdminService usuarios;
    public UsuariosAdminController(UsuariosAdminService usuarios) { this.usuarios=usuarios; }

    // Mantiene GET /usuarios para los consumidores existentes.
    @GetMapping("/pagina")
    public Pagina pagina(@RequestParam(defaultValue="") String busqueda,
            @RequestParam(defaultValue="todos") String rol, @RequestParam(defaultValue="todos") String perfil,
            @RequestParam(defaultValue="todos") String estado, @RequestParam(defaultValue="0") int pagina,
            @RequestParam(defaultValue="20") int tamano) {
        return usuarios.listar(busqueda,rol,perfil,estado,pagina,tamano);
    }
    @GetMapping("/{id}")
    public Detalle detalle(@PathVariable long id) { return usuarios.detalle(id); }
    @PutMapping("/{id}")
    public Detalle editar(@PathVariable long id,@Valid @RequestBody Editar r,
            @AuthenticationPrincipal UsuarioAutenticado admin) { return usuarios.editar(admin.id(),id,r); }
    @PatchMapping("/{id}/estado")
    public Detalle estado(@PathVariable long id,@Valid @RequestBody Estado r,
            @AuthenticationPrincipal UsuarioAutenticado admin) { return usuarios.estado(admin.id(),id,r); }
    @GetMapping("/{id}/historial")
    public List<Cambio> historial(@PathVariable long id,@RequestParam(defaultValue="0") int pagina) {
        return usuarios.historial(id,pagina);
    }
}

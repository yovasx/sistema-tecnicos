package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.application.AdminService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Backoffice administrativo.
 *
 * <p>Lectura de resumen, usuarios, catálogo y cola de técnicos; escritura del
 * catálogo. La ruta exige rol administrador en {@code SecurityConfig} y la
 * función de Postgres vuelve a validarlo antes de tocar datos.</p>
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService admin;

    public AdminController(AdminService admin) {
        this.admin = admin;
    }

    @GetMapping("/resumen")
    public ResumenAdmin resumen() {
        return admin.resumen();
    }

    @GetMapping("/usuarios")
    public List<UsuarioAdmin> usuarios() {
        return admin.usuarios();
    }

    @GetMapping("/categorias")
    public List<CategoriaAdmin> categorias() {
        return admin.categorias();
    }

    @PostMapping("/categorias")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoriaAdmin crearCategoria(
            @Valid @RequestBody GuardarCategoriaRequest request,
            @AuthenticationPrincipal UsuarioAutenticado adminActual) {
        return admin.guardarCategoria(adminActual.id(), null, request);
    }

    @PutMapping("/categorias/{id}")
    public CategoriaAdmin editarCategoria(
            @PathVariable Integer id,
            @Valid @RequestBody GuardarCategoriaRequest request,
            @AuthenticationPrincipal UsuarioAutenticado adminActual) {
        return admin.guardarCategoria(adminActual.id(), id, request);
    }

    @GetMapping("/tecnicos/pendientes")
    public List<TecnicoPendiente> tecnicosPendientes() {
        return admin.tecnicosPendientes();
    }
}

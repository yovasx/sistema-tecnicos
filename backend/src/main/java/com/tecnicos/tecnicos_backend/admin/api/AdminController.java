package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.application.AdminService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Lectura del backoffice administrativo.
 *
 * <p>Solo GET: la creación, aprobación y rechazo entran cuando la V2 tenga sus
 * funciones y endpoints de escritura. La ruta exige rol administrador en
 * {@code SecurityConfig}.</p>
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

    @GetMapping("/tecnicos/pendientes")
    public List<TecnicoPendiente> tecnicosPendientes() {
        return admin.tecnicosPendientes();
    }
}

package com.tecnicos.tecnicos_backend.publico.api;

import com.tecnicos.tecnicos_backend.publico.application.PublicoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Datos que la landing puede mostrar sin sesión. */
@RestController
@RequestMapping("/api/publico")
public class PublicoController {

    private final PublicoService publico;

    public PublicoController(PublicoService publico) {
        this.publico = publico;
    }

    @GetMapping("/categorias")
    public List<CategoriaPublica> categorias() {
        return publico.categorias();
    }
}

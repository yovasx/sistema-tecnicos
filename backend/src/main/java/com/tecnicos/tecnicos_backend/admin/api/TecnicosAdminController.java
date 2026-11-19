package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.api.TecnicosAdminDtos.*;
import com.tecnicos.tecnicos_backend.admin.application.TecnicosAdminService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/tecnicos")
public class TecnicosAdminController {
    private final TecnicosAdminService tecnicos;
    public TecnicosAdminController(TecnicosAdminService tecnicos) { this.tecnicos=tecnicos; }
    @GetMapping
    public Pagina pagina(@RequestParam(defaultValue="") String busqueda,
            @RequestParam(defaultValue="todos") String cuenta,@RequestParam(defaultValue="todos") String expediente,
            @RequestParam(defaultValue="todos") String disponibilidad,@RequestParam(required=false) Integer categoria,
            @RequestParam(defaultValue="0") int pagina,@RequestParam(defaultValue="20") int tamano) {
        return tecnicos.listar(busqueda,cuenta,expediente,disponibilidad,categoria,pagina,tamano);
    }
    @GetMapping("/{id}")
    public Detalle detalle(@PathVariable long id) { return tecnicos.detalle(id); }
    @GetMapping("/{id}/revisiones")
    public List<Revision> revisiones(@PathVariable long id,@RequestParam(defaultValue="0") int pagina) {
        return tecnicos.revisiones(id,pagina);
    }
}

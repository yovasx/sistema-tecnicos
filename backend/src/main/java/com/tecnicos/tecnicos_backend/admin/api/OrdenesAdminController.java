package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.api.OrdenesAdminDtos.*;
import com.tecnicos.tecnicos_backend.admin.application.OrdenesAdminService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Solo lectura. La autorización /api/admin exige administrador y sesión vigente. */
@RestController
@RequestMapping("/api/admin/ordenes")
public class OrdenesAdminController {
    private final OrdenesAdminService ordenes;

    public OrdenesAdminController(OrdenesAdminService ordenes) { this.ordenes=ordenes; }

    @GetMapping
    public ResponseEntity<Pagina<Fila>> listar(@RequestParam(defaultValue="") String busqueda,
            @RequestParam(defaultValue="todos") String estado,
            @RequestParam(required=false) Integer categoria,
            @RequestParam(defaultValue="todos") String asignacion,
            @RequestParam(defaultValue="") String desde, @RequestParam(defaultValue="") String hasta,
            @RequestParam(defaultValue="0") int pagina, @RequestParam(defaultValue="20") int tamano) {
        return privado(ordenes.listar(busqueda,estado,categoria,asignacion,desde,hasta,pagina,tamano));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Detalle> detalle(@PathVariable long id) { return privado(ordenes.detalle(id)); }

    @GetMapping("/{id}/historial")
    public ResponseEntity<Pagina<Transicion>> historial(@PathVariable long id,
            @RequestParam(defaultValue="0") int pagina, @RequestParam(defaultValue="20") int tamano) {
        return privado(ordenes.historial(id,pagina,tamano));
    }

    private static <T> ResponseEntity<T> privado(T cuerpo) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(cuerpo);
    }
}

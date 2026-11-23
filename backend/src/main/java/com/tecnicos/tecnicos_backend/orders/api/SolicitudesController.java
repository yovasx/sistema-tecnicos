package com.tecnicos.tecnicos_backend.orders.api;

import com.tecnicos.tecnicos_backend.orders.application.SolicitudesService;
import com.tecnicos.tecnicos_backend.orders.api.SolicitudesDtos.*;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

@RestController
@RequestMapping("/api/ordenes")
public class SolicitudesController {
    private final SolicitudesService solicitudes;
    public SolicitudesController(SolicitudesService solicitudes) { this.solicitudes=solicitudes; }

    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CrearResultado> crear(@RequestParam String clave,
            @RequestParam int categoria, @RequestParam String descripcion,
            @RequestParam double latitud,@RequestParam double longitud,
            @RequestParam String referencia,@RequestParam boolean urgencia,
            @RequestParam(required=false) MultipartFile[] evidencia) throws IOException {
        if(evidencia!=null && evidencia.length>1) throw new com.tecnicos.tecnicos_backend.shared.web.ApiException(
            HttpStatus.BAD_REQUEST,"ARCHIVO_NO_PERMITIDO","Adjuntá una sola evidencia.");
        var r=solicitudes.crear(clave,categoria,descripcion,latitud,longitud,referencia,urgencia,
            evidencia==null || evidencia.length==0?null:evidencia[0]);
        return ResponseEntity.status(r.creada()?HttpStatus.CREATED:HttpStatus.OK)
            .cacheControl(CacheControl.noStore()).body(r);
    }
    @GetMapping("/categorias")
    public ResponseEntity<java.util.List<Categoria>> categorias() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(solicitudes.categorias());
    }
    @GetMapping("/facturacion")
    public ResponseEntity<Facturacion> facturacion() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(solicitudes.facturacion(usuario().id()));
    }
    @GetMapping
    public ResponseEntity<Pagina<Fila>> propias(@RequestParam(defaultValue="0") int pagina,
            @RequestParam(defaultValue="20") int tamano) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(solicitudes.propias(usuario().id(),pagina,tamano));
    }
    @GetMapping("/{id}")
    public ResponseEntity<Detalle> detalle(@PathVariable long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(solicitudes.detalle(usuario().id(),id));
    }
    @GetMapping("/{id}/evidencia")
    public ResponseEntity<InputStreamResource> evidencia(@PathVariable long id) throws IOException {
        var r=solicitudes.evidencia(usuario(),id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options","nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename("evidencia"+r.extension()).build().toString())
            .contentType(MediaType.APPLICATION_OCTET_STREAM).body(new InputStreamResource(r.contenido()));
    }
    private UsuarioAutenticado usuario() {
        return (UsuarioAutenticado)SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}

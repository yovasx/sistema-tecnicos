package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.application.OperacionLocalService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/operacion")
public class OperacionLocalController {
    private final OperacionLocalService servicio;
    public OperacionLocalController(OperacionLocalService servicio) { this.servicio=servicio; }
    @GetMapping public ResponseEntity<?> panel() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(servicio.panel());
    }
}

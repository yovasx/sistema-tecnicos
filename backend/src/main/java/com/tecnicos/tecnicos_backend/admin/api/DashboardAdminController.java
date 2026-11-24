package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.application.DashboardAdminService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/dashboard")
public class DashboardAdminController {
    private final DashboardAdminService dashboard;
    public DashboardAdminController(DashboardAdminService dashboard) { this.dashboard = dashboard; }
    @GetMapping
    public ResponseEntity<DashboardAdmin> consultar(@RequestParam(defaultValue = "7") int dias) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(dashboard.consultar(dias));
    }
}

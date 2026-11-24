package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.identity.api.ExpedienteAdminResumen;
import com.tecnicos.tecnicos_backend.identity.api.ObservarRequest;
import com.tecnicos.tecnicos_backend.identity.api.RechazarRequest;
import com.tecnicos.tecnicos_backend.identity.application.TecnicoService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Cola de validación de expedientes técnicos (backoffice web).
 *
 * <p>Solo administrador. La aprobación final es humana por el tramo documental;
 * lo verificable por reglas ya lo hizo la base antes de llegar aquí.</p>
 */
@RestController
@RequestMapping("/api/admin/tecnicos/expedientes")
public class ValidacionController {

    private final TecnicoService tecnicos;

    public ValidacionController(TecnicoService tecnicos) {
        this.tecnicos = tecnicos;
    }

    @GetMapping
    public List<ExpedienteAdminResumen> listosParaRevisar(
            @RequestParam(name = "estado", defaultValue = "en_revision") String estado) {
        return tecnicos.expedientes(estado);
    }

    @PostMapping("/{tecnicoId}/observar")
    public void observar(@PathVariable Long tecnicoId,
                         @Valid @RequestBody ObservarRequest request,
                         @AuthenticationPrincipal com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado admin) {
        tecnicos.observar(admin.id(), tecnicoId, request);
    }

    @GetMapping("/{tecnicoId}")
    public com.tecnicos.tecnicos_backend.identity.api.ExpedienteResponse detalle(@PathVariable Long tecnicoId) {
        return tecnicos.expedienteAdministrativo(tecnicoId);
    }

    @PostMapping("/{tecnicoId}/aprobar")
    public void aprobar(@PathVariable Long tecnicoId,
                        @AuthenticationPrincipal com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado admin) {
        tecnicos.aprobar(admin.id(), tecnicoId);
    }

    @PostMapping("/{tecnicoId}/rechazar")
    public void rechazar(@PathVariable Long tecnicoId,
                         @Valid @RequestBody RechazarRequest request,
                         @AuthenticationPrincipal com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado admin) {
        tecnicos.rechazar(admin.id(), tecnicoId, request);
    }
}

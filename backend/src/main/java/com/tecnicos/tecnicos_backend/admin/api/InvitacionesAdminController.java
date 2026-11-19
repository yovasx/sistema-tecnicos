package com.tecnicos.tecnicos_backend.admin.api;

import com.tecnicos.tecnicos_backend.admin.application.InvitacionesAdminService;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class InvitacionesAdminController {
    private final InvitacionesAdminService invitaciones;
    public InvitacionesAdminController(InvitacionesAdminService invitaciones) { this.invitaciones=invitaciones; }
    @PostMapping("/api/admin/usuarios/invitaciones")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void invitar(@AuthenticationPrincipal UsuarioAutenticado admin,
                        @Valid @RequestBody UsuariosAdminDtos.Invitacion r) { invitaciones.invitar(admin.id(),r); }
    @PostMapping("/api/auth/invitaciones/aceptar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void aceptar(@Valid @RequestBody UsuariosAdminDtos.AceptarInvitacion r) { invitaciones.aceptar(r); }
}

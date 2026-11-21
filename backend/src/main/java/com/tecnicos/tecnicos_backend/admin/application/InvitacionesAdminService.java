package com.tecnicos.tecnicos_backend.admin.application;

import com.tecnicos.tecnicos_backend.admin.api.UsuariosAdminDtos.*;
import com.tecnicos.tecnicos_backend.shared.mail.ServicioEmail;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;

@Service
public class InvitacionesAdminService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final ServicioEmail correo;
    private final PasswordEncoder claves;
    private final ObjectMapper json;
    private final SecureRandom azar=new SecureRandom();
    public InvitacionesAdminService(JdbcTemplate jdbc,AuditoriaContexto auditoria,ServicioEmail correo,
                                    PasswordEncoder claves,ObjectMapper json) {
        this.jdbc=jdbc; this.auditoria=auditoria; this.correo=correo; this.claves=claves; this.json=json;
    }
    @Transactional
    public void invitar(long admin,Invitacion r) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT admin_svc.validar_gestion_usuarios(?)",Object.class,admin);
        // Reautenticación antes de crear cuentas, especialmente administradores.
        String hash=jdbc.queryForObject("SELECT password_hash FROM identity.usuarios WHERE id=? FOR SHARE",String.class,admin);
        if(hash==null || r.passwordAdmin().getBytes(StandardCharsets.UTF_8).length>72
            || !claves.matches(r.passwordAdmin(),hash)) throw new ApiException(
            HttpStatus.FORBIDDEN,"REAUTENTICACION_REQUERIDA","La contraseña del administrador no es correcta.");
        byte[] bytes=new byte[32]; azar.nextBytes(bytes);
        String permiso=HexFormat.of().formatHex(bytes);
        // Lista explícita: nunca serializar passwordAdmin en datos ni auditoría.
        Map<String,Object> datos=new LinkedHashMap<>();
        datos.put("nombre",r.nombre()); datos.put("apellido",r.apellido()); datos.put("rol",r.rol());
        datos.put("tipoCliente",r.tipoCliente()); datos.put("telefono",r.telefono());
        datos.put("razonSocial",r.razonSocial()); datos.put("nit",r.nit());
        jdbc.queryForObject("SELECT admin_svc.invitar_usuario(?,?,?::jsonb,?)",Object.class,
            admin,r.email(),json.writeValueAsString(datos),permiso);
        try { correo.enviarInvitacion(r.email().trim(),permiso); }
        catch(RuntimeException e) { throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
            "CORREO_NO_DISPONIBLE","No pudimos enviar la invitación. No se creó ninguna cuenta. Intenta más tarde."); }
    }
    @Transactional
    public void aceptar(AceptarInvitacion r) {
        if(r.password().getBytes(StandardCharsets.UTF_8).length>72) throw new ApiException(
            HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","La contraseña no puede superar 72 bytes.");
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT admin_svc.aceptar_invitacion(?,?,?)",
            Boolean.class,r.email(),r.permiso(),claves.encode(r.password())))) throw new ApiException(
            HttpStatus.BAD_REQUEST,"INVITACION_INVALIDA","La invitación no es válida, venció o ya fue utilizada.");
    }
}

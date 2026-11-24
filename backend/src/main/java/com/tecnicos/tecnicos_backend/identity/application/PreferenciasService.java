package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** La ubicación es siempre puntual y por acción explícita, no un consentimiento de rastreo. */
@Service
public class PreferenciasService {
    public record Preferencias(long revision,boolean permitirGps) {}
    public record Editar(@NotNull(message="Actualiza las preferencias.") Long revision,
        @NotNull(message="Indica si permites el acceso puntual a GPS.") Boolean permitirGps) {}
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    public PreferenciasService(JdbcTemplate jdbc,AuditoriaContexto auditoria) { this.jdbc=jdbc; this.auditoria=auditoria; }
    @Transactional(readOnly=true) public Preferencias propio(long id) {
        var filas=jdbc.query("SELECT revision,compartir_ubicacion FROM identity.preferencias_cliente WHERE usuario_id=?",
            (r,n)->new Preferencias(r.getLong(1),r.getBoolean(2)),id);
        return filas.isEmpty()?new Preferencias(0,true):filas.getFirst();
    }
    @Transactional public Preferencias guardar(long id,Editar r) {
        auditoria.aplicarEnTransaccion();
        var cuenta=jdbc.queryForList("""
            SELECT id FROM identity.usuarios WHERE id=? AND rol='cliente' AND activo AND eliminado_en IS NULL FOR UPDATE
            """,Long.class,id);
        if(cuenta.isEmpty()) throw new ApiException(HttpStatus.FORBIDDEN,"CUENTA_NO_DISPONIBLE","La cuenta no está disponible.");
        var antes=propio(id);
        if(antes.revision()!=r.revision()) throw new ApiException(HttpStatus.CONFLICT,"CAMBIO_CONCURRENTE","Tus preferencias cambiaron. Actualiza antes de guardar.");
        // No ofrecer interruptores de correo/push sin un canal operativo configurado.
        jdbc.queryForObject("""
            SELECT identity.guardar_preferencias(?,COALESCE((SELECT notificaciones_email
              FROM identity.preferencias_cliente WHERE usuario_id=?),true),
              COALESCE((SELECT notificaciones_push FROM identity.preferencias_cliente WHERE usuario_id=?),false),?)
            """,(rs,n)->null,id,id,id,r.permitirGps());
        return propio(id);
    }
}

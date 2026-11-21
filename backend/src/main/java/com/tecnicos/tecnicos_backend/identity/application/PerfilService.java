package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.identity.api.PerfilDtos.*;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;

@Service
public class PerfilService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final PasswordEncoder claves;
    public PerfilService(JdbcTemplate jdbc, AuditoriaContexto auditoria, PasswordEncoder claves) {
        this.jdbc=jdbc; this.auditoria=auditoria; this.claves=claves;
    }
    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Detalle propio(long id) {
        var especialidades=jdbc.queryForList("""
            SELECT c.nombre FROM identity.tecnico_especialidades e
            JOIN orders.categorias_servicio c ON c.id=e.categoria_id
            WHERE e.tecnico_id=? ORDER BY c.id
            """,String.class,id);
        var filas=jdbc.query("""
            SELECT u.id,u.revision_admin,u.nombre,u.apellido,u.email,u.telefono,u.rol::text,
                u.tipo_cliente::text,u.razon_social,u.nit,p.estado_validacion::text,
                CASE WHEN g.usuario_id IS NOT NULL AND u.password_hash IS NOT NULL THEN 'google_y_password'
                     WHEN g.usuario_id IS NOT NULL THEN 'google' ELSE 'password' END AS acceso
            FROM identity.usuarios u
            LEFT JOIN identity.identidades_google g ON g.usuario_id=u.id
            LEFT JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id
            WHERE u.id=? AND u.activo AND u.eliminado_en IS NULL
            """,(r,n)->new Detalle(r.getLong("id"),r.getLong("revision_admin"),r.getString("nombre"),
                r.getString("apellido"),r.getString("email"),r.getString("telefono"),r.getString("rol"),
                r.getString("tipo_cliente"),r.getString("razon_social"),r.getString("nit"),
                r.getString("acceso"),r.getString("estado_validacion"),especialidades),id);
        if (filas.isEmpty()) throw new ApiException(HttpStatus.FORBIDDEN,"CUENTA_NO_DISPONIBLE","La cuenta no está disponible.");
        return filas.getFirst();
    }
    @Transactional
    public Detalle editar(long id, Editar r) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT identity.editar_perfil(?,?,?,?,?,?,?)",Object.class,
            id,r.revision(),r.nombre(),r.apellido(),r.telefono(),r.razonSocial(),r.nit());
        return propio(id);
    }
    @Transactional
    public void password(long id, Password r) {
        auditoria.aplicarEnTransaccion();
        // Mismo lock que recuperación/login: no emitir sesiones con una clave obsoleta.
        var filas=jdbc.queryForList("""
            SELECT password_hash FROM identity.usuarios
            WHERE id=? AND activo AND eliminado_en IS NULL FOR UPDATE
            """,String.class,id);
        if (filas.isEmpty() || filas.getFirst()==null) throw new ApiException(HttpStatus.BAD_REQUEST,
            "SIN_PASSWORD_LOCAL","Tu cuenta usa Google y no tiene una contraseña Fixly.");
        if (r.actual().getBytes(StandardCharsets.UTF_8).length>72 || !claves.matches(r.actual(),filas.getFirst()))
            throw new ApiException(HttpStatus.BAD_REQUEST,
            "PASSWORD_ACTUAL_INVALIDA","La contraseña actual no es correcta.");
        if (r.nueva().getBytes(StandardCharsets.UTF_8).length>72 || r.nueva().equals(r.actual()))
            throw new ApiException(HttpStatus.BAD_REQUEST,"PASSWORD_NUEVA_INVALIDA",
                "Elegí una contraseña diferente, de entre 8 y 72 bytes.");
        jdbc.update("UPDATE identity.usuarios SET password_hash=?,version_sesion=version_sesion+1 WHERE id=?",
            claves.encode(r.nueva()),id);
        // No almacenar claves, hashes ni permisos en la auditoría.
        jdbc.update("""
            INSERT INTO identity.auditoria_perfil(usuario_id,accion,antes,despues)
            VALUES(?,'password','{}','{}')
            """,id);
    }
}

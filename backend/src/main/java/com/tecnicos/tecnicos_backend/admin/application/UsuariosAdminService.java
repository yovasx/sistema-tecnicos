package com.tecnicos.tecnicos_backend.admin.application;

import com.tecnicos.tecnicos_backend.admin.api.UsuariosAdminDtos.*;
import com.tecnicos.tecnicos_backend.admin.api.PerfilAdminEditar;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class UsuariosAdminService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final ObjectMapper json;
    public UsuariosAdminService(JdbcTemplate jdbc, AuditoriaContexto auditoria, ObjectMapper json) {
        this.jdbc=jdbc; this.auditoria=auditoria; this.json=json;
    }

    @Transactional(readOnly=true)
    public Pagina listar(String busqueda, String rol, String perfil, String estado, int pagina, int tamano) {
        if (pagina < 0 || pagina > 100000 || tamano < 1 || tamano > 100 || busqueda.length()>150
            || !Set.of("todos","cliente","tecnico","administrador").contains(rol)
            || !Set.of("todos","persona","empresa").contains(perfil)
            || !Set.of("todos","activo","inactivo").contains(estado)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,"FILTROS_INVALIDOS","Revisa los filtros y la paginación.");
        }
        String where=" WHERE u.eliminado_en IS NULL ";
        List<Object> args=new ArrayList<>();
        if (!busqueda.isBlank()) {
            // position evita tratar % y _ como comodines y no concatena SQL del usuario.
            where+=" AND position(lower(?) in lower(concat_ws(' ',u.id::text,u.nombre,u.apellido,u.razon_social,u.email)))>0";
            args.add(busqueda.trim());
        }
        if (!rol.equals("todos")) { where+=" AND u.rol::text=?"; args.add(rol); }
        if (!perfil.equals("todos")) { where+=" AND u.tipo_cliente::text=?"; args.add(perfil); }
        if (!estado.equals("todos")) { where+=" AND u.activo=?"; args.add(estado.equals("activo")); }
        long total=jdbc.queryForObject("SELECT count(*) FROM identity.usuarios u"+where,Long.class,args.toArray());
        args.add(tamano); args.add(pagina*tamano);
        var filas=jdbc.query("""
                SELECT u.id, CASE WHEN u.tipo_cliente='empresa' THEN u.razon_social
                    ELSE concat_ws(' ',u.nombre,u.apellido) END AS visible,
                    u.email,u.telefono,u.rol::text,u.tipo_cliente::text,u.activo,u.creado_en
                FROM identity.usuarios u
                """+where+" ORDER BY u.creado_en DESC,u.id DESC LIMIT ? OFFSET ?",
                (r,n)->new Fila(r.getLong("id"),r.getString("visible"),r.getString("email"),
                    r.getString("telefono"),r.getString("rol"),r.getString("tipo_cliente"),
                    r.getBoolean("activo"),r.getObject("creado_en",OffsetDateTime.class)),args.toArray());
        return new Pagina(filas,total,pagina,tamano);
    }

    @Transactional(readOnly=true)
    public Detalle detalle(long id) {
        var filas=jdbc.query("""
                SELECT u.id,u.nombre,u.apellido,u.email,u.telefono,u.rol::text,u.tipo_cliente::text,
                    u.razon_social,u.nit,u.activo,u.creado_en,u.revision_admin,
                    CASE WHEN g.usuario_id IS NOT NULL AND u.password_hash IS NOT NULL THEN 'google_y_password'
                         WHEN g.usuario_id IS NOT NULL THEN 'google' ELSE 'password' END AS acceso,
                    p.estado_validacion::text
                FROM identity.usuarios u
                LEFT JOIN identity.identidades_google g ON g.usuario_id=u.id
                LEFT JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id
                WHERE u.id=? AND u.eliminado_en IS NULL
                """,(r,n)->new Detalle(r.getLong("id"),r.getString("nombre"),r.getString("apellido"),
                    r.getString("email"),r.getString("telefono"),r.getString("rol"),r.getString("tipo_cliente"),
                    r.getString("razon_social"),r.getString("nit"),r.getBoolean("activo"),
                    r.getObject("creado_en",OffsetDateTime.class),r.getLong("revision_admin"),
                    r.getString("acceso"),r.getString("estado_validacion")),id);
        if (filas.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"USUARIO_NO_ENCONTRADO","La cuenta no existe.");
        return filas.getFirst();
    }

    @Transactional
    public Detalle editarPerfil(long admin, PerfilAdminEditar r) {
        var actual = detalle(admin);
        return editar(admin, admin, new Editar(r.revision(), r.nombre(), r.apellido(), r.telefono(),
                actual.razonSocial(), actual.nit(), r.motivo()));
    }

    @Transactional
    public Detalle editar(long admin,long id,Editar r) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT admin_svc.editar_usuario(?,?,?,?,?,?,?,?,?)",Object.class,
                admin,id,r.revision(),r.nombre(),r.apellido(),r.telefono(),r.razonSocial(),r.nit(),r.motivo());
        return detalle(id);
    }

    @Transactional
    public Detalle estado(long admin,long id,Estado r) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT admin_svc.cambiar_estado_usuario(?,?,?,?,?)",Object.class,
                admin,id,r.revision(),r.activo(),r.motivo());
        return detalle(id);
    }

    @Transactional(readOnly=true)
    public List<Cambio> historial(long id,int pagina) {
        if(pagina<0 || pagina>100000) throw new ApiException(HttpStatus.BAD_REQUEST,"FILTROS_INVALIDOS","Página inválida.");
        detalle(id);
        return jdbc.query("""
                SELECT a.*,concat_ws(' ',u.nombre,u.apellido) AS administrador
                FROM admin_svc.auditoria_usuarios a JOIN identity.usuarios u ON u.id=a.admin_id
                WHERE a.usuario_id=? ORDER BY a.id DESC LIMIT 20 OFFSET ?
                """,(r,n)->new Cambio(r.getLong("id"),r.getString("administrador"),r.getString("accion"),
                    r.getString("motivo"),json.readValue(r.getString("antes"),new TypeReference<Map<String,Object>>(){}),
                    json.readValue(r.getString("despues"),new TypeReference<Map<String,Object>>(){}),
                    r.getObject("creado_en",OffsetDateTime.class)),id,pagina*20);
    }
}

package com.tecnicos.tecnicos_backend.admin.application;

import com.tecnicos.tecnicos_backend.admin.api.TecnicosAdminDtos.*;
import com.tecnicos.tecnicos_backend.identity.application.TecnicoService;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.sql.Array;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class TecnicosAdminService {
    private final JdbcTemplate jdbc;
    private final UsuariosAdminService usuarios;
    private final TecnicoService tecnicos;
    private final ObjectMapper json;
    public TecnicosAdminService(JdbcTemplate jdbc,UsuariosAdminService usuarios,TecnicoService tecnicos,ObjectMapper json) {
        this.jdbc=jdbc; this.usuarios=usuarios; this.tecnicos=tecnicos; this.json=json;
    }
    @Transactional(readOnly=true)
    public Pagina listar(String busqueda,String cuenta,String expediente,String disponibilidad,
                         Integer categoria,int pagina,int tamano) {
        if(busqueda.length()>150 || pagina<0 || pagina>100000 || tamano<1 || tamano>100
           || (categoria!=null && categoria<1)
           || !Set.of("todos","activo","inactivo").contains(cuenta)
           || !Set.of("todos","borrador","en_revision","observado","aprobado","rechazado").contains(expediente)
           || !Set.of("todos","disponible","fuera_servicio","ocupado").contains(disponibilidad)) {
            throw new ApiException(HttpStatus.BAD_REQUEST,"FILTROS_INVALIDOS","Revisá los filtros de técnicos.");
        }
        String base=" FROM identity.usuarios u JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id ";
        String where=" WHERE u.rol='tecnico' AND u.eliminado_en IS NULL ";
        List<Object> args=new ArrayList<>();
        if(!busqueda.isBlank()) {
            where+=" AND position(lower(?) in lower(concat_ws(' ',u.id::text,u.nombre,u.apellido,u.email)))>0";
            args.add(busqueda.trim());
        }
        if(!cuenta.equals("todos")) { where+=" AND u.activo=?"; args.add(cuenta.equals("activo")); }
        if(!expediente.equals("todos")) { where+=" AND p.estado_expediente::text=?"; args.add(expediente); }
        if(!disponibilidad.equals("todos")) { where+=" AND p.disponibilidad::text=?"; args.add(disponibilidad); }
        if(categoria!=null) {
            where+=" AND EXISTS(SELECT 1 FROM identity.tecnico_especialidades e WHERE e.tecnico_id=u.id AND e.categoria_id=?)";
            args.add(categoria);
        }
        long total=jdbc.queryForObject("SELECT count(*)"+base+where,Long.class,args.toArray());
        args.add(tamano); args.add(pagina*tamano);
        var filas=jdbc.query("""
            SELECT u.id,concat_ws(' ',u.nombre,u.apellido) AS nombre,u.email,u.activo,
                p.estado_validacion::text,p.estado_expediente::text,p.disponibilidad::text,
                p.expediente_requerido,p.enviado_en,
                ARRAY(SELECT c.nombre FROM identity.tecnico_especialidades e
                      JOIN orders.categorias_servicio c ON c.id=e.categoria_id
                      WHERE e.tecnico_id=u.id ORDER BY c.nombre,c.id) AS especialidades
            """+base+where+" ORDER BY u.creado_en DESC,u.id DESC LIMIT ? OFFSET ?",
            (r,n)->new Fila(r.getLong("id"),r.getString("nombre"),r.getString("email"),r.getBoolean("activo"),
                r.getString("estado_validacion"),r.getString("estado_expediente"),r.getString("disponibilidad"),
                textos(r.getArray("especialidades")),r.getBoolean("expediente_requerido"),
                r.getObject("enviado_en",OffsetDateTime.class)),args.toArray());
        return new Pagina(filas,total,pagina,tamano);
    }
    @Transactional(readOnly=true)
    public Detalle detalle(long id) {
        var expediente=tecnicos.expedienteAdministrativo(id);
        return jdbc.queryForObject("""
            SELECT p.expediente_requerido,p.fecha_validacion,
                NULLIF(concat_ws(' ',a.nombre,a.apellido),'') AS aprobado_por
            FROM identity.perfiles_tecnico p LEFT JOIN identity.usuarios a ON a.id=p.validado_por
            WHERE p.usuario_id=?
            """,(r,n)->new Detalle(usuarios.detalle(id),expediente,r.getBoolean("expediente_requerido"),
                r.getObject("fecha_validacion",OffsetDateTime.class),r.getString("aprobado_por")),id);
    }
    @Transactional(readOnly=true)
    public List<Revision> revisiones(long id,int pagina) {
        if(pagina<0 || pagina>100000) throw new ApiException(HttpStatus.BAD_REQUEST,"FILTROS_INVALIDOS","Página inválida.");
        // Valida pertenencia al rol sin leer el expediente privado completo.
        boolean existe=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.usuarios u JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id
            WHERE u.id=? AND u.rol='tecnico' AND u.eliminado_en IS NULL)
            """,Boolean.class,id));
        if(!existe) throw new ApiException(HttpStatus.NOT_FOUND,"TECNICO_NO_ENCONTRADO","El técnico no existe.");
        return jdbc.query("""
            SELECT r.id,concat_ws(' ',u.nombre,u.apellido) AS revisor,r.decision::text,r.observaciones,r.creado_en
            FROM identity.revisiones_tecnico r JOIN identity.usuarios u ON u.id=r.revisor_id
            WHERE r.tecnico_id=? ORDER BY r.id DESC LIMIT 20 OFFSET ?
            """,(r,n)->new Revision(r.getLong("id"),r.getString("revisor"),r.getString("decision"),
                json.readValue(r.getString("observaciones"),new TypeReference<Map<String,String>>(){}),
                r.getObject("creado_en",OffsetDateTime.class)),id,pagina*20);
    }
    private static List<String> textos(Array array) throws SQLException {
        if(array==null) return List.of();
        try { return Arrays.stream((Object[])array.getArray()).map(Object::toString).toList(); }
        finally { array.free(); }
    }
}

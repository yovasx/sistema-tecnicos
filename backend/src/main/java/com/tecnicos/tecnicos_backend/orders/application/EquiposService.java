package com.tecnicos.tecnicos_backend.orders.application;

import com.tecnicos.tecnicos_backend.orders.api.EquiposController.*;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class EquiposService {
    public record Equipo(long id,long revision,Long sucursal,String nombre,String marca,String modelo,String identificador,boolean activo) {}
    public record Sucursal(long id,long revision,String nombre,String referencia,boolean activa) {}
    public record Historial(long orden,String categoria,String estado,String trabajo,String conformidad,
        LocalDate proximoMantenimiento,OffsetDateTime creadoEn) {}
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    public EquiposService(JdbcTemplate jdbc,AuditoriaContexto auditoria) { this.jdbc=jdbc;this.auditoria=auditoria; }
    @Transactional(readOnly=true) public List<Equipo> equipos(long cliente) {
        return jdbc.query("SELECT * FROM orders.equipos_cliente WHERE cliente_id=? ORDER BY activo DESC,id DESC LIMIT 100",
            (r,n)->new Equipo(r.getLong("id"),r.getLong("revision"),r.getObject("sucursal_id",Long.class),r.getString("nombre"),
                r.getString("marca"),r.getString("modelo"),r.getString("identificador"),r.getBoolean("activo")),cliente);
    }
    @Transactional(readOnly=true) public List<Sucursal> sucursales(long cliente) {
        return jdbc.query("SELECT * FROM identity.sucursales_cliente WHERE cliente_id=? ORDER BY activa DESC,id",
            (r,n)->new Sucursal(r.getLong("id"),r.getLong("revision"),r.getString("nombre"),r.getString("referencia"),r.getBoolean("activa")),cliente);
    }
    @Transactional public Map<String,Long> guardar(Long id,EquipoDatos r) {
        auditoria.aplicarEnTransaccion();
        return Map.of("id",jdbc.queryForObject("SELECT orders.guardar_equipo(?,?,?,?,?,?,?,?)",Long.class,
            id,r.revision(),r.sucursal(),r.nombre(),r.marca(),r.modelo(),r.identificador(),r.activo()));
    }
    @Transactional public Map<String,Long> guardarSucursal(Long id,SucursalDatos r) {
        auditoria.aplicarEnTransaccion();
        return Map.of("id",jdbc.queryForObject("SELECT identity.guardar_sucursal(?,?,?,?,?)",Long.class,
            id,r.revision(),r.nombre(),r.referencia(),r.activa()));
    }
    @Transactional(readOnly=true) public List<Historial> historial(long cliente,long equipo) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM orders.equipos_cliente WHERE id=? AND cliente_id=?)",
            Boolean.class,equipo,cliente))) throw new ApiException(HttpStatus.NOT_FOUND,"EQUIPO_NO_DISPONIBLE","El equipo no está disponible.");
        return jdbc.query("""
            SELECT o.id,c.nombre,o.estado::text,a.trabajo_realizado,a.conformidad,a.proximo_mantenimiento,o.creado_en
            FROM orders.equipos_orden e JOIN orders.ordenes_servicio o ON o.id=e.orden_id
            JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            LEFT JOIN orders.atenciones a ON a.orden_id=o.id WHERE e.equipo_id=? AND o.cliente_id=?
            ORDER BY o.id DESC LIMIT 100
            """,(r,n)->new Historial(r.getLong("id"),r.getString("nombre"),r.getString("estado"),r.getString("trabajo_realizado"),
                r.getString("conformidad"),r.getObject("proximo_mantenimiento",LocalDate.class),r.getObject("creado_en",OffsetDateTime.class)),equipo,cliente);
    }
}

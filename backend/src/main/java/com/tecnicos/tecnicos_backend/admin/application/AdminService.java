package com.tecnicos.tecnicos_backend.admin.application;

import com.tecnicos.tecnicos_backend.admin.api.CategoriaAdmin;
import com.tecnicos.tecnicos_backend.admin.api.ResumenAdmin;
import com.tecnicos.tecnicos_backend.admin.api.TecnicoPendiente;
import com.tecnicos.tecnicos_backend.admin.api.UsuarioAdmin;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Array;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Listados de lectura del backoffice.
 *
 * <p>Solo SELECT sobre tablas existentes: aquí no hay máquina de estados ni
 * reglas de negocio, así que no hace falta llamar a funciones de la base. Las
 * columnas son exactamente las de V1/V3; no se inventa ninguna.</p>
 */
@Service
public class AdminService {

    private final JdbcTemplate jdbc;

    public AdminService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public ResumenAdmin resumen() {
        return jdbc.queryForObject("""
                SELECT
                  (SELECT count(*) FROM identity.usuarios u WHERE u.eliminado_en IS NULL) AS total_usuarios,
                  (SELECT count(*) FROM identity.usuarios u WHERE u.eliminado_en IS NULL AND u.rol = 'cliente') AS clientes,
                  (SELECT count(*) FROM identity.usuarios u WHERE u.eliminado_en IS NULL AND u.rol = 'tecnico') AS tecnicos,
                  (SELECT count(*) FROM identity.usuarios u WHERE u.eliminado_en IS NULL AND u.rol = 'administrador') AS administradores,
                  (SELECT count(*) FROM identity.perfiles_tecnico p WHERE p.estado_validacion = 'pendiente') AS tecnicos_pendientes,
                  (SELECT count(*) FROM identity.perfiles_tecnico p WHERE p.estado_validacion = 'aprobado') AS tecnicos_aprobados,
                  (SELECT count(*) FROM orders.categorias_servicio c WHERE c.activa) AS categorias_activas
                """,
                (rs, n) -> new ResumenAdmin(
                        rs.getLong("total_usuarios"),
                        rs.getLong("clientes"),
                        rs.getLong("tecnicos"),
                        rs.getLong("administradores"),
                        rs.getLong("tecnicos_pendientes"),
                        rs.getLong("tecnicos_aprobados"),
                        rs.getLong("categorias_activas")));
    }

    @Transactional(readOnly = true)
    public List<UsuarioAdmin> usuarios() {
        return jdbc.query("""
                SELECT id,
                       CASE WHEN tipo_cliente = 'empresa'
                                 AND razon_social IS NOT NULL AND btrim(razon_social) <> ''
                            THEN razon_social
                            ELSE nombre || ' ' || apellido END AS nombre,
                       email,
                       rol,
                       tipo_cliente AS tipo_cliente,
                       activo,
                       creado_en
                FROM identity.usuarios
                WHERE eliminado_en IS NULL
                ORDER BY id
                """,
                (rs, n) -> new UsuarioAdmin(
                        rs.getLong("id"),
                        rs.getString("nombre"),
                        rs.getString("email"),
                        rs.getString("rol"),
                        rs.getString("tipo_cliente"),
                        rs.getBoolean("activo"),
                        rs.getObject("creado_en", OffsetDateTime.class)));
    }

    @Transactional(readOnly = true)
    public List<CategoriaAdmin> categorias() {
        return jdbc.query("""
                SELECT c.id, c.nombre, c.descripcion, c.activa,
                       t.tarifa_visita, t.tarifa_hora, t.recargo_urgencia_pct, t.moneda,
                       co.porcentaje AS comision_pct
                FROM orders.categorias_servicio c
                LEFT JOIN billing.tarifas t ON t.categoria_id = c.id
                LEFT JOIN billing.comisiones co ON co.categoria_id = c.id
                ORDER BY c.id
                """,
                (rs, n) -> new CategoriaAdmin(
                        rs.getInt("id"),
                        rs.getString("nombre"),
                        rs.getString("descripcion"),
                        rs.getBoolean("activa"),
                        rs.getBigDecimal("tarifa_visita"),
                        rs.getBigDecimal("tarifa_hora"),
                        rs.getBigDecimal("recargo_urgencia_pct"),
                        rs.getString("moneda"),
                        rs.getBigDecimal("comision_pct")));
    }

    @Transactional(readOnly = true)
    public List<TecnicoPendiente> tecnicosPendientes() {
        return jdbc.query("""
                SELECT p.usuario_id,
                       u.nombre || ' ' || u.apellido AS nombre,
                       u.email,
                       p.estado_validacion,
                       p.disponibilidad,
                       p.certificaciones_url
                FROM identity.perfiles_tecnico p
                JOIN identity.usuarios u ON u.id = p.usuario_id
                WHERE p.estado_validacion = 'pendiente'
                ORDER BY p.usuario_id
                """,
                (rs, n) -> new TecnicoPendiente(
                        rs.getLong("usuario_id"),
                        rs.getString("nombre"),
                        rs.getString("email"),
                        rs.getString("estado_validacion"),
                        rs.getString("disponibilidad"),
                        aTexto(rs.getArray("certificaciones_url"))));
    }

    private static String aTexto(Array array) {
        if (array == null) {
            return null;
        }
        try {
            return String.valueOf(array.getArray());
        } catch (Exception ex) {
            return null;
        }
    }
}

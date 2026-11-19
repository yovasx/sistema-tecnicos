package com.tecnicos.tecnicos_backend.admin.application;

import com.tecnicos.tecnicos_backend.admin.api.DashboardAdmin;
import com.tecnicos.tecnicos_backend.admin.api.DashboardAdmin.*;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;

@Service
public class DashboardAdminService {
    private static final ZoneId BOLIVIA = ZoneId.of("America/La_Paz");
    private final JdbcTemplate jdbc;
    public DashboardAdminService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public DashboardAdmin consultar(int dias) {
        if (dias != 7 && dias != 30) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILTROS_INVALIDOS", "Elegí un período de 7 o 30 días.");
        }
        var generado = jdbc.queryForObject("SELECT CURRENT_TIMESTAMP", OffsetDateTime.class);
        var hasta = generado.atZoneSameInstant(BOLIVIA).toLocalDate();
        var desde = hasta.minusDays(dias - 1L);
        var metricas = jdbc.queryForObject("""
            SELECT
              (SELECT count(*) FROM orders.ordenes_servicio
                 WHERE estado NOT IN ('finalizado', 'cancelado')) AS abiertas,
              (SELECT count(*) FROM orders.ordenes_servicio
                 WHERE estado='solicitado' AND tecnico_id IS NULL) AS sin_asignar,
              (SELECT count(*) FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
                 WHERE u.rol='tecnico' AND u.activo AND u.eliminado_en IS NULL
                   AND p.estado_expediente='en_revision') AS en_revision,
              (SELECT count(*) FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
                 WHERE u.rol='tecnico' AND u.activo AND u.eliminado_en IS NULL
                   AND p.estado_validacion='aprobado') AS aprobados,
              (SELECT count(*) FROM identity.usuarios WHERE activo AND eliminado_en IS NULL) AS usuarios,
              (SELECT count(*) FROM orders.categorias_servicio WHERE activa) AS categorias
            """, (r, n) -> new Metricas(r.getLong("abiertas"), r.getLong("sin_asignar"),
                r.getLong("en_revision"), r.getLong("aprobados"), r.getLong("usuarios"), r.getLong("categorias")));
        // La serie incluye días sin actividad y agrupa por el día de Bolivia, no por UTC.
        var serie = jdbc.query("""
            WITH dias AS (SELECT generate_series(?::date, ?::date, interval '1 day')::date AS fecha),
            conteos AS (
              SELECT (creado_en AT TIME ZONE 'America/La_Paz')::date AS fecha, count(*) AS cantidad
              FROM orders.ordenes_servicio WHERE creado_en >= ? AND creado_en < ? GROUP BY 1
            )
            SELECT d.fecha, coalesce(c.cantidad, 0) AS cantidad
            FROM dias d LEFT JOIN conteos c ON c.fecha=d.fecha ORDER BY d.fecha
            """, (r, n) -> new Dia(r.getObject("fecha", LocalDate.class), r.getLong("cantidad")),
            desde, hasta, desde.atStartOfDay(BOLIVIA).toOffsetDateTime(),
            hasta.plusDays(1).atStartOfDay(BOLIVIA).toOffsetDateTime());
        var solicitudes = jdbc.query("""
            SELECT o.id, c.nombre, o.tarifa_urgencia, o.creado_en
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            WHERE o.estado='solicitado' AND o.tecnico_id IS NULL
            ORDER BY o.tarifa_urgencia DESC, o.creado_en, o.id LIMIT 5
            """, (r, n) -> new Solicitud(r.getLong("id"), r.getString("nombre"),
                r.getBoolean("tarifa_urgencia"), r.getObject("creado_en", OffsetDateTime.class)));
        var expedientes = jdbc.query("""
            SELECT u.id, concat_ws(' ',u.nombre,u.apellido) AS nombre, p.enviado_en
            FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
            WHERE u.rol='tecnico' AND u.activo AND u.eliminado_en IS NULL AND p.estado_expediente='en_revision'
            ORDER BY p.enviado_en NULLS LAST, u.id LIMIT 5
            """, (r, n) -> new Expediente(r.getLong("id"), r.getString("nombre"),
                r.getObject("enviado_en", OffsetDateTime.class)));
        return new DashboardAdmin(generado, desde, hasta, metricas, serie, solicitudes, expedientes);
    }
}

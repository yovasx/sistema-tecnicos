package com.tecnicos.tecnicos_backend.admin.application;

import com.tecnicos.tecnicos_backend.admin.api.BackofficeDtos.*;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Módulos operativos del backoffice que ya tienen fuente real: auditoría
 * unificada, moderación de chat, notificaciones, liquidaciones, mapa en vivo y
 * reporte CSV. No hay pagos, push ni métricas inventadas.
 */
@Service
public class BackofficeService {
    private static final ZoneId BOLIVIA = ZoneId.of("America/La_Paz");
    private static final Pattern PREFIJO_FORMULA_CSV = Pattern.compile("^[\\p{Cc}\\p{Zs}]*[=+\\-@]");
    private static final Set<String> TIPOS = Set.of("oferta_orden", "cambio_estado", "cotizacion_enviada",
        "cotizacion_respondida", "tarifa_urgencia", "mensaje_chat", "pago", "disputa", "sistema");
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final ObjectMapper json;
    public BackofficeService(JdbcTemplate jdbc, AuditoriaContexto auditoria, ObjectMapper json) {
        this.jdbc = jdbc; this.auditoria = auditoria; this.json = json;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Pagina<Auditoria> auditoria(String origen, int pagina) {
        pagina(pagina);
        boolean filtra = origen != null && !origen.isBlank();
        long total = filtra
            ? jdbc.queryForObject("SELECT count(*) FROM admin_svc.auditoria_unificada WHERE origen=?",
                Long.class, origen)
            : jdbc.queryForObject("SELECT count(*) FROM admin_svc.auditoria_unificada", Long.class);
        String sql = """
            SELECT a.id, a.origen, a.sujeto_id, a.actor_id, a.accion, a.motivo,
                   a.detalle::text AS detalle, a.creado_en,
                   CASE a.origen
                     WHEN 'catalogo' THEN (SELECT nombre FROM orders.categorias_servicio WHERE id=a.sujeto_id)
                     WHEN 'cobertura' THEN 'Propuesta #' || a.sujeto_id
                     WHEN 'orden' THEN 'Orden #' || a.sujeto_id
                     ELSE (SELECT NULLIF(concat_ws(' ', nombre, apellido), '') FROM identity.usuarios WHERE id=a.sujeto_id)
                   END AS sujeto,
                   CASE WHEN a.actor_id IS NULL THEN NULL
                        ELSE (SELECT NULLIF(concat_ws(' ', nombre, apellido), '') FROM identity.usuarios WHERE id=a.actor_id)
                   END AS actor
            FROM admin_svc.auditoria_unificada a
            """ + (filtra ? " WHERE a.origen=? " : " ") + """
            ORDER BY a.creado_en DESC, a.id DESC LIMIT 50 OFFSET ?
            """;
        Object[] args = filtra ? new Object[]{origen, pagina * 50} : new Object[]{pagina * 50};
        var filas = jdbc.query(sql, (r, n) -> new Auditoria(r.getLong("id"), r.getString("origen"),
            r.getString("sujeto"), r.getObject("sujeto_id", Long.class), r.getString("actor"),
            r.getObject("actor_id", Long.class), r.getString("accion"), r.getString("motivo"),
            mapa(r.getString("detalle")), r.getObject("creado_en", OffsetDateTime.class)), args);
        return new Pagina<>(filas, total, pagina, 50);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapa(String detalle) {
        if (detalle == null || detalle.isBlank()) return Map.of();
        try { return json.readValue(detalle, Map.class); }
        catch (RuntimeException e) { return Map.of(); }
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Pagina<MensajeModerado> moderacion(boolean soloPendientes, int pagina) {
        pagina(pagina);
        long total = soloPendientes
            ? jdbc.queryForObject("""
                SELECT count(*) FROM chat.mensajes m
                LEFT JOIN admin_svc.moderacion_mensajes mod ON mod.mensaje_id=m.id
                WHERE m.contiene_contacto AND mod.mensaje_id IS NULL
                """, Long.class)
            : jdbc.queryForObject("SELECT count(*) FROM chat.mensajes WHERE contiene_contacto", Long.class);
        var filas = jdbc.query("""
            SELECT m.id, m.contenido, m.enviado_en,
                   o.id orden, c.nombre categoria,
                   CASE WHEN e.eliminado_en IS NULL THEN NULLIF(concat_ws(' ',e.nombre,e.apellido),'') END emisor,
                   CASE WHEN r.eliminado_en IS NULL THEN NULLIF(concat_ws(' ',r.nombre,r.apellido),'') END receptor,
                   mod.decision, mod.nota, mod.revisado_en
            FROM chat.mensajes m
            JOIN chat.conversaciones cv ON cv.id=m.conversacion_id
            JOIN orders.ordenes_servicio o ON o.id=cv.orden_id
            JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            JOIN identity.usuarios e ON e.id=m.emisor_id
            JOIN identity.usuarios r ON r.id=CASE WHEN m.emisor_id=cv.cliente_id THEN cv.tecnico_id ELSE cv.cliente_id END
            LEFT JOIN admin_svc.moderacion_mensajes mod ON mod.mensaje_id=m.id
            WHERE m.contiene_contacto AND (?=FALSE OR mod.mensaje_id IS NULL)
            ORDER BY (mod.mensaje_id IS NULL) DESC, m.enviado_en DESC, m.id DESC LIMIT 50 OFFSET ?
            """, (r, n) -> new MensajeModerado(r.getLong("id"), r.getLong("orden"), r.getString("categoria"),
                r.getString("emisor"), r.getString("receptor"), r.getString("contenido"),
                r.getString("decision") != null, r.getString("decision"), r.getString("nota"),
                r.getObject("enviado_en", OffsetDateTime.class), r.getObject("revisado_en", OffsetDateTime.class)),
            soloPendientes, pagina * 50);
        return new Pagina<>(filas, total, pagina, 50);
    }

    @Transactional
    public void revisarMensaje(UsuarioAutenticado admin, long mensaje, RevisionMensaje datos) {
        auditoria.aplicarEnTransaccion();
        jdbc.query("SELECT admin_svc.revisar_mensaje(?,?,?)", (r, n) -> null,
            mensaje, datos.decision(), datos.nota());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Pagina<NotificacionSistema> notificaciones(String tipo, int pagina) {
        pagina(pagina);
        boolean filtra = tipo != null && !tipo.isBlank();
        if (filtra && !TIPOS.contains(tipo))
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILTROS_INVALIDOS", "El tipo de notificación no es válido.");
        long total = filtra
            ? jdbc.queryForObject("SELECT count(*) FROM notification.notificaciones WHERE tipo=?::notification.tipo_notificacion",
                Long.class, tipo)
            : jdbc.queryForObject("SELECT count(*) FROM notification.notificaciones", Long.class);
        String sql = """
            SELECT n.id, n.usuario_id, n.orden_id, n.tipo::text, n.mensaje, n.leido, n.enviado_en,
                   CASE WHEN u.eliminado_en IS NULL
                        THEN NULLIF(concat_ws(' ',u.nombre,u.apellido),'') END usuario
            FROM notification.notificaciones n JOIN identity.usuarios u ON u.id=n.usuario_id
            """ + (filtra ? " WHERE n.tipo=?::notification.tipo_notificacion " : " ") + """
            ORDER BY n.enviado_en DESC, n.id DESC LIMIT 50 OFFSET ?
            """;
        Object[] args = filtra ? new Object[]{tipo, pagina * 50} : new Object[]{pagina * 50};
        var filas = jdbc.query(sql, (r, n) -> new NotificacionSistema(r.getLong("id"), r.getLong("usuario_id"),
            r.getString("usuario"), r.getObject("orden_id", Long.class), r.getString("tipo"),
            r.getString("mensaje"), r.getBoolean("leido"), r.getObject("enviado_en", OffsetDateTime.class)), args);
        return new Pagina<>(filas, total, pagina, 50);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Pagina<LiquidacionAdmin> liquidaciones(String estado, int pagina) {
        pagina(pagina);
        boolean filtra = estado != null && !estado.isBlank();
        if (filtra && !Set.of("pendiente_pago_tecnico", "pagada_tecnico", "por_cobrar_tecnico",
            "cobrada_tecnico").contains(estado))
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILTROS_INVALIDOS", "El estado no es válido.");
        long total = filtra
            ? jdbc.queryForObject("SELECT count(*) FROM billing.liquidaciones WHERE estado=?::billing.estado_liquidacion",
                Long.class, estado)
            : jdbc.queryForObject("SELECT count(*) FROM billing.liquidaciones", Long.class);
        String sql = """
            SELECT l.id, l.orden_id, l.monto_bruto, l.comision_pct, l.comision_monto, l.neto_tecnico,
                   l.estado::text, l.creada_en, l.liquidada_en,
                   CASE WHEN u.eliminado_en IS NULL THEN NULLIF(concat_ws(' ',u.nombre,u.apellido),'') END tecnico
            FROM billing.liquidaciones l JOIN identity.usuarios u ON u.id=l.tecnico_id
            """ + (filtra ? " WHERE l.estado=?::billing.estado_liquidacion " : " ") + """
            ORDER BY l.creada_en DESC, l.id DESC LIMIT 50 OFFSET ?
            """;
        Object[] args = filtra ? new Object[]{estado, pagina * 50} : new Object[]{pagina * 50};
        var filas = jdbc.query(sql, (r, n) -> new LiquidacionAdmin(r.getLong("id"), r.getLong("orden_id"),
            r.getString("tecnico"), r.getBigDecimal("monto_bruto"), r.getBigDecimal("comision_pct"),
            r.getBigDecimal("comision_monto"), r.getBigDecimal("neto_tecnico"), r.getString("estado"),
            r.getObject("creada_en", OffsetDateTime.class), r.getObject("liquidada_en", OffsetDateTime.class)), args);
        return new Pagina<>(filas, total, pagina, 50);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<PuntoActivo> mapa() {
        return jdbc.query("""
            SELECT o.id, c.nombre categoria, o.estado::text, o.tarifa_urgencia, o.creado_en,
                   CASE WHEN t.eliminado_en IS NULL THEN NULLIF(concat_ws(' ',t.nombre,t.apellido),'') END tecnico,
                   ST_Y(o.ubicacion_cliente::geometry) latitud_cliente,
                   ST_X(o.ubicacion_cliente::geometry) longitud_cliente,
                   CASE WHEN ub.actualizado_en > clock_timestamp() - interval '30 seconds'
                        THEN ST_Y(ub.punto::geometry) END latitud_tecnico,
                   CASE WHEN ub.actualizado_en > clock_timestamp() - interval '30 seconds'
                        THEN ST_X(ub.punto::geometry) END longitud_tecnico,
                   ub.actualizado_en
            FROM orders.ordenes_servicio o
            JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            LEFT JOIN identity.usuarios t ON t.id=o.tecnico_id
            LEFT JOIN geo.ubicacion_actual ub ON ub.tecnico_id=o.tecnico_id
            WHERE o.estado IN ('en_camino','en_diagnostico','en_reparacion')
            ORDER BY o.estado, o.id LIMIT 100
            """, (r, n) -> new PuntoActivo(r.getLong("id"), r.getString("categoria"), r.getString("estado"),
            r.getBoolean("tarifa_urgencia"), r.getString("tecnico"),
            r.getDouble("latitud_cliente"), r.getDouble("longitud_cliente"),
            r.getObject("latitud_tecnico", Double.class), r.getObject("longitud_tecnico", Double.class),
            r.getObject("actualizado_en", OffsetDateTime.class), r.getObject("creado_en", OffsetDateTime.class)));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResumenOperativo resumen() {
        return jdbc.queryForObject("""
            SELECT
              (SELECT count(*) FROM orders.ofertas_orden WHERE estado='enviada' AND expira_en>clock_timestamp()) AS ofertas,
              (SELECT count(*) FROM orders.ordenes_servicio WHERE estado='solicitado' AND tecnico_id IS NULL) AS sin_tecnico,
              (SELECT count(*) FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
                 WHERE u.activo AND u.eliminado_en IS NULL AND p.estado_validacion='aprobado'
                   AND p.disponibilidad='disponible') AS disponibles,
              (SELECT count(*) FROM admin_svc.disputas WHERE estado<>'resuelta') AS disputas,
              (SELECT count(*) FROM chat.mensajes m
                 LEFT JOIN admin_svc.moderacion_mensajes mod ON mod.mensaje_id=m.id
                 WHERE m.contiene_contacto AND mod.mensaje_id IS NULL) AS moderacion
            """, (r, n) -> new ResumenOperativo(r.getLong("ofertas"), r.getLong("sin_tecnico"),
            r.getLong("disponibles"), r.getLong("disputas"), r.getLong("moderacion")));
    }

    /** Reporte de órdenes sin datos personales ni direcciones. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public String reporteOrdenes(LocalDate desde, LocalDate hasta) {
        if (desde == null || hasta == null || desde.isAfter(hasta) || hasta.isAfter(desde.plusDays(366)))
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILTROS_INVALIDOS",
                "Selecciona un rango de fechas válido de hasta 366 días.");
        var filas = jdbc.query("""
            SELECT o.id, c.nombre categoria, o.estado::text, o.tarifa_urgencia,
                   o.creado_en AS creada,
                   CASE WHEN t.eliminado_en IS NULL THEN NULLIF(concat_ws(' ',t.nombre,t.apellido),'') END tecnico,
                   q.total, q.moneda
            FROM orders.ordenes_servicio o
            JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            LEFT JOIN identity.usuarios t ON t.id=o.tecnico_id
            LEFT JOIN LATERAL (
                SELECT total, moneda FROM billing.cotizaciones
                WHERE orden_id=o.id AND estado='aceptada' ORDER BY version DESC LIMIT 1
            ) q ON TRUE
            WHERE o.creado_en >= ? AND o.creado_en < ?
            ORDER BY o.id
            """, (r, n) -> new Object[]{r.getLong("id"), r.getString("categoria"), r.getString("estado"),
            r.getBoolean("tarifa_urgencia"), r.getObject("creada", OffsetDateTime.class),
            r.getString("tecnico"), r.getBigDecimal("total"), r.getString("moneda")},
            desde.atStartOfDay(BOLIVIA).toOffsetDateTime(),
            hasta.plusDays(1).atStartOfDay(BOLIVIA).toOffsetDateTime());
        var salida = new StringBuilder("\uFEFF");
        salida.append("Orden,Categoría,Estado,Urgente,Creada (Bolivia),Técnico,Total cotizado,Moneda\r\n");
        for (Object[] f : filas) {
            salida.append(f[0]).append(',')
                .append(csv((String) f[1])).append(',')
                .append(csv((String) f[2])).append(',')
                .append(Boolean.TRUE.equals(f[3]) ? "Sí" : "No").append(',')
                .append(f[4] == null ? "" : ((OffsetDateTime) f[4]).atZoneSameInstant(BOLIVIA)
                    .toLocalDateTime().toString()).append(',')
                .append(csv((String) f[5])).append(',')
                .append(f[6] == null ? "" : ((BigDecimal) f[6]).toPlainString()).append(',')
                .append(csv((String) f[7])).append("\r\n");
        }
        return salida.toString();
    }

    private static String csv(String valor) {
        if (valor == null) return "";
        String seguro = PREFIJO_FORMULA_CSV.matcher(valor).find() ? "'" + valor : valor;
        String limpio = seguro.replace("\"", "\"\"");
        return "\"" + limpio + "\"";
    }

    private static void pagina(int p) {
        if (p < 0 || p > 100000)
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAGINA_INVALIDA", "La página no es válida.");
    }
}

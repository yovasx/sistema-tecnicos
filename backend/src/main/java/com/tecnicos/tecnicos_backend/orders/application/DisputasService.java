package com.tecnicos.tecnicos_backend.orders.application;

import com.tecnicos.tecnicos_backend.orders.api.DisputasDtos.*;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Disputas de una orden cerrada.
 *
 * <p>La apertura y la revisión viven en funciones SQL: validan participantes,
 * estados y resolución obligatoria. Aquí solo se orquesta y se pagina.</p>
 */
@Service
public class DisputasService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    public DisputasService(JdbcTemplate jdbc, AuditoriaContexto auditoria) {
        this.jdbc = jdbc; this.auditoria = auditoria;
    }

    private static final String SELECT = """
        SELECT d.id, d.orden_id, c.nombre AS categoria, d.estado::text AS estado, d.motivo,
               d.resolucion,
               CASE WHEN au.eliminado_en IS NULL
                    THEN NULLIF(concat_ws(' ', au.nombre, au.apellido), '') END AS abierta_por,
               CASE WHEN cu.eliminado_en IS NULL
                    THEN NULLIF(concat_ws(' ', cu.nombre, cu.apellido), '') END AS contra_usuario,
               CASE WHEN ad.eliminado_en IS NULL
                    THEN NULLIF(concat_ws(' ', ad.nombre, ad.apellido), '') END AS administrador,
               d.abierta_en, d.resuelta_en
        FROM admin_svc.disputas d
        JOIN orders.ordenes_servicio o ON o.id = d.orden_id
        JOIN orders.categorias_servicio c ON c.id = o.categoria_id
        JOIN identity.usuarios au ON au.id = d.abierta_por_id
        JOIN identity.usuarios cu ON cu.id = d.contra_usuario_id
        LEFT JOIN identity.usuarios ad ON ad.id = d.administrador_id
        """;

    private static Disputa fila(java.sql.ResultSet r, int n) throws java.sql.SQLException {
        return new Disputa(r.getLong("id"), r.getLong("orden_id"), r.getString("categoria"),
            r.getString("estado"), r.getString("motivo"), r.getString("resolucion"),
            r.getString("abierta_por"), r.getString("contra_usuario"), r.getString("administrador"),
            r.getObject("abierta_en", OffsetDateTime.class),
            r.getObject("resuelta_en", OffsetDateTime.class));
    }

    @Transactional
    public long abrir(UsuarioAutenticado usuario, Nueva datos) {
        if (usuario.rol() != com.tecnicos.tecnicos_backend.identity.domain.RolUsuario.cliente
            && usuario.rol() != com.tecnicos.tecnicos_backend.identity.domain.RolUsuario.tecnico) {
            throw new ApiException(HttpStatus.FORBIDDEN, "DISPUTA_NO_PERMITIDA",
                "Solo el cliente o el técnico pueden abrir una disputa.");
        }
        auditoria.aplicarEnTransaccion();
        return jdbc.queryForObject("SELECT admin_svc.abrir_disputa(?,?)", Long.class,
            datos.orden(), datos.motivo().trim());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Pagina propias(long usuario, int pagina,Long orden) {
        pagina(pagina);
        long total = jdbc.queryForObject("""
            SELECT count(*) FROM admin_svc.disputas
            WHERE (abierta_por_id = ? OR contra_usuario_id = ?) AND (?::bigint IS NULL OR orden_id=?)
            """, Long.class, usuario, usuario,orden,orden);
        var filas = jdbc.query(SELECT + """
            WHERE (d.abierta_por_id = ? OR d.contra_usuario_id = ?) AND (?::bigint IS NULL OR d.orden_id=?)
            ORDER BY (d.estado <> 'resuelta') DESC, d.abierta_en DESC, d.id DESC
            LIMIT 20 OFFSET ?
            """, DisputasService::fila, usuario, usuario,orden,orden, pagina * 20);
        return new Pagina(filas, total, pagina, 20);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Pagina administracion(String estado, int pagina) {
        pagina(pagina);
        boolean filtra = estado != null && !estado.isBlank();
        if (filtra && !List.of("abierta", "en_revision", "resuelta").contains(estado))
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILTROS_INVALIDOS", "El estado no es válido.");
        long total = filtra
            ? jdbc.queryForObject("SELECT count(*) FROM admin_svc.disputas WHERE estado = ?::admin_svc.estado_disputa",
                Long.class, estado)
            : jdbc.queryForObject("SELECT count(*) FROM admin_svc.disputas", Long.class);
        var filas = filtra
            ? jdbc.query(SELECT + """
                WHERE d.estado = ?::admin_svc.estado_disputa
                ORDER BY (d.estado <> 'resuelta') DESC, d.abierta_en, d.id LIMIT 20 OFFSET ?
                """, DisputasService::fila, estado, pagina * 20)
            : jdbc.query(SELECT + """
                ORDER BY (d.estado <> 'resuelta') DESC, d.abierta_en, d.id LIMIT 20 OFFSET ?
                """, DisputasService::fila, pagina * 20);
        return new Pagina(filas, total, pagina, 20);
    }

    @Transactional
    public String revisar(UsuarioAutenticado admin, long disputa, Revision datos) {
        auditoria.aplicarEnTransaccion();
        return jdbc.queryForObject("SELECT admin_svc.revisar_disputa(?,?,?)", String.class,
            disputa, datos.estado(), datos.resolucion());
    }

    private static void pagina(int p) {
        if (p < 0 || p > 100000)
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAGINA_INVALIDA", "La página no es válida.");
    }
}

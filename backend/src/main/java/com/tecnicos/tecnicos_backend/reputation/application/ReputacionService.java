package com.tecnicos.tecnicos_backend.reputation.application;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.reputation.api.ReputacionDtos.Calificar;
import com.tecnicos.tecnicos_backend.reputation.api.ReputacionDtos.Creada;
import com.tecnicos.tecnicos_backend.reputation.api.ReputacionDtos.Recibida;
import com.tecnicos.tecnicos_backend.reputation.api.ReputacionDtos.Resumen;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Reputación del cliente y del técnico.
 *
 * <p>Las calificaciones se insertan solo a través de
 * {@code reputation.calificar}, que valida en la base que el actor sea parte de
 * la orden finalizada y que el destinatario sea la contraparte. El promedio se
 * mantiene en un índice por trigger, nunca se recalcula en Java.</p>
 */
@Service
public class ReputacionService {

    private static final int ULTIMAS = 20;

    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;

    public ReputacionService(JdbcTemplate jdbc, AuditoriaContexto auditoria) {
        this.jdbc = jdbc;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Resumen propio(UsuarioAutenticado usuario) {
        long id = usuario.id();
        // El resumen se agrega desde las calificaciones: siempre coincide con lo
        // que el usuario ve, sin depender de índices calculados para el matching.
        var fila = jdbc.queryForMap("""
            SELECT COALESCE(round(avg(puntaje),2),0)::float8 AS promedio, count(*) AS total
            FROM reputation.calificaciones WHERE calificado_id=?
            """, id);
        long finalizadas = 0;
        long canceladas = 0;
        if (usuario.rol() == RolUsuario.cliente) {
            finalizadas = jdbc.queryForObject("""
                SELECT count(*) FROM orders.ordenes_servicio
                WHERE cliente_id=? AND estado='finalizado'
                """, Long.class, id);
            canceladas = jdbc.queryForObject("""
                SELECT count(*) FROM orders.ordenes_servicio
                WHERE cliente_id=? AND estado='cancelado'
                """, Long.class, id);
        } else if (usuario.rol() == RolUsuario.tecnico) {
            finalizadas = jdbc.queryForObject("""
                SELECT count(*) FROM orders.ordenes_servicio
                WHERE tecnico_id=? AND estado='finalizado'
                """, Long.class, id);
        }
        var recibidas = jdbc.query("""
            SELECT c.id,c.puntaje,c.comentario,c.registrado_en,cat.nombre AS categoria,
                NULLIF(split_part(coalesce(u.nombre,''),' ',1),'') AS autor
            FROM reputation.calificaciones c
            JOIN orders.ordenes_servicio o ON o.id=c.orden_id
            JOIN orders.categorias_servicio cat ON cat.id=o.categoria_id
            LEFT JOIN identity.usuarios u ON u.id=c.calificador_id AND u.eliminado_en IS NULL
            WHERE c.calificado_id=?
            ORDER BY c.registrado_en DESC, c.id DESC LIMIT ?
            """,(r,n)->new Recibida(r.getLong("id"),r.getShort("puntaje"),r.getString("comentario"),
                r.getString("categoria"),r.getString("autor"),
                r.getObject("registrado_en",OffsetDateTime.class)),id,ULTIMAS);
        return new Resumen(((Number)fila.get("promedio")).doubleValue(),
            ((Number)fila.get("total")).longValue(),finalizadas,canceladas,recibidas);
    }

    @Transactional
    public Creada calificar(long ordenId, Calificar datos) {
        auditoria.aplicarEnTransaccion();
        var actor=auditoria.usuarioActual();
        if(actor==null || jdbc.queryForList("""
            SELECT id FROM identity.usuarios WHERE id=? AND activo AND eliminado_en IS NULL FOR SHARE
            """,Long.class,actor).isEmpty())
            throw new ApiException(HttpStatus.FORBIDDEN,"CUENTA_NO_DISPONIBLE","La cuenta no está disponible.");
        Long id = jdbc.queryForObject("SELECT reputation.calificar(?::bigint,?::smallint,?::text)",Long.class,
            ordenId,datos.puntaje(),datos.comentario());
        return new Creada(id, datos.puntaje().shortValue());
    }
}

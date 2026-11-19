package com.tecnicos.tecnicos_backend.publico.application;

import com.tecnicos.tecnicos_backend.publico.api.CategoriaPublica;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Lectura pública del catálogo.
 *
 * <p>La landing no debe tener tarifas escritas a mano: las lee de orders y
 * billing. Solo se exponen categorías activas y los campos comerciales
 * publicables; la comisión de la plataforma queda fuera.</p>
 */
@Service
public class PublicoService {

    private final JdbcTemplate jdbc;

    public PublicoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<CategoriaPublica> categorias() {
        return jdbc.query("""
                SELECT c.nombre,
                       c.descripcion,
                       t.tarifa_visita,
                       t.tarifa_hora,
                       t.moneda
                FROM orders.categorias_servicio c
                LEFT JOIN LATERAL (
                    SELECT tarifa_visita, tarifa_hora, moneda
                    FROM billing.tarifas
                    WHERE categoria_id = c.id
                      AND vigente_desde <= CURRENT_DATE
                      AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
                    ORDER BY vigente_desde DESC, id DESC
                    LIMIT 1
                ) t ON TRUE
                WHERE c.activa
                ORDER BY c.id
                """,
                (rs, n) -> new CategoriaPublica(
                        rs.getString("nombre"),
                        rs.getString("descripcion"),
                        rs.getBigDecimal("tarifa_visita"),
                        rs.getBigDecimal("tarifa_hora"),
                        rs.getString("moneda")));
    }
}

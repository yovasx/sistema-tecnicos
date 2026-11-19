package com.tecnicos.tecnicos_backend.shared.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.time.Instant;
import java.util.Map;

/**
 * Healthcheck real de la plataforma.
 *
 * <p>La app móvil llama a {@code GET /api/ping} en su pantalla de estado y
 * distingue tres casos: conectado, sin conexión (no llega la respuesta) y
 * error del servidor (llega pero la base no responde). Por eso este endpoint
 * consulta la base en vez de devolver un {@code "status": "ok"} fijo.</p>
 */
@RestController
@RequestMapping("/api")
public class PingController {

    private final JdbcTemplate jdbc;

    public PingController(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        Instant ahora = Instant.now();
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "service", "tecnicos-backend",
                    "base", "ok",
                    "timestamp", ahora.toString()
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "error",
                    "codigo", "BASE_NO_DISPONIBLE",
                    "mensaje", "El servicio responde, pero la base de datos no está disponible.",
                    "service", "tecnicos-backend",
                    "base", "no_disponible",
                    "timestamp", ahora.toString()
            ));
        }
    }
}

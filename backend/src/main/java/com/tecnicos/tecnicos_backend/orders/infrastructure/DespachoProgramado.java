package com.tecnicos.tecnicos_backend.orders.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Un advisory lock en PostgreSQL evita despachos duplicados entre instancias. */
@Component
public class DespachoProgramado {
    private static final Logger log = LoggerFactory.getLogger(DespachoProgramado.class);
    private final JdbcTemplate jdbc;
    public DespachoProgramado(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Scheduled(fixedDelayString="${app.despacho.intervalo-ms:15000}", initialDelay=60000)
    @Transactional
    public void despachar() {
        jdbc.queryForObject("SELECT orders.mantener_ofertas()", Integer.class);
    }
}

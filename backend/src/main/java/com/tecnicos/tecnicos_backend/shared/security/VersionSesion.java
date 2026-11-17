package com.tecnicos.tecnicos_backend.shared.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Versión persistente: recuperar la contraseña invalida todos los JWT anteriores. */
@Service
public class VersionSesion {
    private final JdbcTemplate jdbc;
    public VersionSesion(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Long actual(Long id) {
        var valores=jdbc.queryForList("SELECT version_sesion FROM identity.usuarios WHERE id=?",Long.class,id);
        return valores.isEmpty()?null:valores.getFirst();
    }
}

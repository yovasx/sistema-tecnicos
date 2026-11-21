package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.identity.api.DireccionesDtos.Fila;
import com.tecnicos.tecnicos_backend.identity.api.DireccionesDtos.Guardar;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Libreta de direcciones del cliente.
 *
 * <p>Las reglas viven en las funciones de la base: una sola predeterminada,
 * máximo diez activas, baja lógica y auditoría con el actor de la transacción.
 * La orden guarda una copia del texto y del punto, así que editar o quitar una
 * dirección nunca altera el historial.</p>
 */
@Service
public class DireccionesService {

    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;

    public DireccionesService(JdbcTemplate jdbc, AuditoriaContexto auditoria) {
        this.jdbc = jdbc;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly=true)
    public List<Fila> listar(long usuario) {
        return jdbc.query("""
            SELECT d.id,d.etiqueta,d.referencia,
                ST_Y(d.punto::geometry) AS latitud, ST_X(d.punto::geometry) AS longitud,
                d.predeterminada
            FROM identity.direcciones_cliente d
            WHERE d.usuario_id=? AND d.activa
            ORDER BY d.predeterminada DESC, d.id
            """,(r,n)->new Fila(r.getLong("id"),r.getString("etiqueta"),r.getString("referencia"),
                r.getDouble("latitud"),r.getDouble("longitud"),r.getBoolean("predeterminada")),usuario);
    }

    @Transactional
    public Fila guardar(long usuario, Long direccionId, Guardar datos) {
        auditoria.aplicarEnTransaccion();
        // Serializar altas y cambios de predeterminada para el mismo dueño.
        bloquearClienteActivo(usuario);
        if(direccionId!=null) exigirPropia(usuario,direccionId);
        Long id = jdbc.queryForObject("SELECT identity.guardar_direccion(?::bigint,?::bigint,?,?,?,?,?)",Long.class,
            usuario,direccionId,datos.etiqueta(),datos.referencia(),
            datos.latitud(),datos.longitud(),datos.predeterminada());
        return buscar(usuario, id);
    }

    @Transactional
    public void eliminar(long usuario, long direccionId) {
        auditoria.aplicarEnTransaccion();
        bloquearClienteActivo(usuario);
        exigirPropia(usuario,direccionId);
        // La función devuelve void: el mapeo a null evita depender del tipo void.
        jdbc.queryForObject("SELECT identity.eliminar_direccion(?::bigint,?::bigint)",
            (rs,n) -> null, usuario, direccionId);
    }

    private Fila buscar(long usuario, long id) {
        return jdbc.queryForObject("""
            SELECT d.id,d.etiqueta,d.referencia,
                ST_Y(d.punto::geometry) AS latitud, ST_X(d.punto::geometry) AS longitud,
                d.predeterminada
            FROM identity.direcciones_cliente d
            WHERE d.id=? AND d.usuario_id=? AND d.activa
            """,(r,n)->new Fila(r.getLong("id"),r.getString("etiqueta"),r.getString("referencia"),
                r.getDouble("latitud"),r.getDouble("longitud"),r.getBoolean("predeterminada")),id,usuario);
    }
    private void exigirPropia(long usuario,long id) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.direcciones_cliente
                WHERE id=? AND usuario_id=? AND activa)
            """,Boolean.class,id,usuario)))
            throw new ApiException(HttpStatus.NOT_FOUND,"DIRECCION_NO_ENCONTRADA","La dirección no está disponible.");
    }
    private void bloquearClienteActivo(long usuario) {
        var ids=jdbc.queryForList("""
            SELECT id FROM identity.usuarios WHERE id=? AND rol='cliente'
                AND activo AND eliminado_en IS NULL FOR UPDATE
            """,Long.class,usuario);
        if(ids.isEmpty()) throw new ApiException(HttpStatus.FORBIDDEN,"CUENTA_NO_DISPONIBLE",
            "La cuenta no está disponible.");
    }
}

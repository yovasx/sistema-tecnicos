package com.tecnicos.tecnicos_backend.shared.persistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;

/**
 * Contexto de auditoría: guarda el usuario autenticado en un ThreadLocal y lo
 * publica a Postgres con {@code set_config('app.usuario_id', ?, true)}.
 *
 * <p><b>Por qué existe</b>: los triggers de la base leen
 * {@code orders.usuario_actual()}, que a su vez lee {@code app.usuario_id}.
 * Ese valor es <b>local a la transacción</b> ({@code is_local = true}), así que
 * tiene que setearse <b>dentro</b> de la transacción y no en un filtro previo.
 * Si se setea afuera, el trigger ve NULL y la auditoría queda ciega.</p>
 *
 * <p><b>Uso obligatorio</b>: la primera línea de todo servicio
 * {@code @Transactional} debe ser {@link #aplicarEnTransaccion()}. Se eligió un
 * llamado explícito en lugar de un aspecto AOP porque el aspecto corre fuera
 * del {@code TransactionInterceptor} y no ve la transacción.</p>
 */
@Component
public class AuditoriaContexto {

    private static final ThreadLocal<Long> USUARIO_ACTUAL = new ThreadLocal<>();
    private static final ThreadLocal<Boolean> LIMPIEZA_REGISTRADA = new ThreadLocal<>();

    private final JdbcTemplate jdbc;

    public AuditoriaContexto(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** Resuelve el usuario del JWT. Lo llama el filtro de seguridad, antes de cualquier servicio. */
    public void definirUsuario(Long usuarioId) {
        USUARIO_ACTUAL.set(usuarioId);
    }

    public Long usuarioActual() {
        return USUARIO_ACTUAL.get();
    }

    public boolean hayUsuario() {
        return USUARIO_ACTUAL.get() != null;
    }

    /**
     * Borra el ThreadLocal. Lo llama el filtro de cada request en {@code finally},
     * porque las peticiones de solo lectura no abren transacción y nunca llegan a
     * registrar la limpieza automática.
     */
    public void limpiar() {
        USUARIO_ACTUAL.remove();
        LIMPIEZA_REGISTRADA.remove();
    }

    /**
     * Primera línea de todo método {@code @Transactional}.
     *
     * <p>Si no hay transacción activa lanza {@link IllegalStateException}: es
     * mejor fallar ruidosamente que registrar NULL en silencio.</p>
     */
    public void aplicarEnTransaccion() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException(
                    "AuditoriaContexto.aplicarEnTransaccion() invocado sin transaccion activa. "
                            + "Debe ser la primera linea de un metodo @Transactional.");
        }

        Long usuarioId = USUARIO_ACTUAL.get();
        // '' se convierte en NULL dentro de orders.usuario_actual() (NULLIF).
        jdbc.queryForObject("SELECT set_config('app.usuario_id', ?, true)",
                String.class, usuarioId == null ? "" : String.valueOf(usuarioId));

        registrarLimpieza();
    }

    /** Vuelca el ThreadLocal al final de la transacción para no filtrarlo entre requests. */
    private void registrarLimpieza() {
        if (Boolean.TRUE.equals(LIMPIEZA_REGISTRADA.get())) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                limpiar();
            }
        });
        LIMPIEZA_REGISTRADA.set(Boolean.TRUE);
    }
}

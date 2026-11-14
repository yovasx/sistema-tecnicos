package com.tecnicos.tecnicos_backend.shared.persistence;

import com.tecnicos.tecnicos_backend.identity.domain.EstadoDisponibilidad;
import com.tecnicos.tecnicos_backend.identity.domain.EstadoValidacion;
import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.orders.domain.EstadoOferta;
import com.tecnicos.tecnicos_backend.orders.domain.EstadoOrden;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Dos riesgos que rompen todo en silencio:
 *
 * <ol>
 *   <li>Un enum Java que no coincida con {@code pg_enum} → Hibernate valida el
 *       esquema, pero los filtros {@code WHERE estado = ...} dejan de traer
 *       filas sin avisar.</li>
 *   <li>{@code app.usuario_id} seteado fuera de la transacción → el trigger ve
 *       NULL y la auditoría queda ciega para siempre.</li>
 * </ol>
 */
@SpringBootTest
class EspejoBaseDeDatosTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private AuditoriaContexto auditoria;

    @Test
    void los_enums_java_coinciden_exactamente_con_pg_enum() {
        Map<String, Class<?>> mapeados = new HashMap<>();
        mapeados.put("rol_usuario", RolUsuario.class);
        mapeados.put("estado_validacion", EstadoValidacion.class);
        mapeados.put("estado_disponibilidad", EstadoDisponibilidad.class);
        mapeados.put("estado_orden", EstadoOrden.class);
        mapeados.put("estado_oferta", EstadoOferta.class);

        Map<String, List<String>> enPostgres = new HashMap<>();
        RowCallbackHandler acumular = rs -> enPostgres
                .computeIfAbsent(rs.getString("tipo"), k -> new ArrayList<>())
                .add(rs.getString("valor"));

        jdbc.query("""
                SELECT t.typname AS tipo, e.enumlabel AS valor
                FROM pg_type t
                JOIN pg_enum e    ON e.enumtypid = t.oid
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname IN ('identity','orders','billing','chat',
                                    'reputation','admin_svc','notification')
                ORDER BY t.typname, e.enumsortorder
                """, acumular);

        for (Map.Entry<String, Class<?>> entry : mapeados.entrySet()) {
            String tipo = entry.getKey();
            List<String> enBase = enPostgres.get(tipo);

            assertThat(enBase)
                    .as("el tipo nativo %s debe existir en Postgres", tipo)
                    .isNotNull();

            List<String> enJava = new ArrayList<>();
            for (Object constante : entry.getValue().getEnumConstants()) {
                enJava.add(((Enum<?>) constante).name());
            }

            assertThat(enJava)
                    .as("el enum Java %s debe ser espejo exacto de pg_enum", tipo)
                    .containsExactlyInAnyOrderElementsOf(enBase);
        }
    }

    @Test
    void aplicar_en_transaccion_sin_transaccion_falla_ruidoso() {
        assertThatThrownBy(() -> auditoria.aplicarEnTransaccion())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("sin transaccion activa");
    }

    @Test
    void la_base_expone_las_funciones_que_el_backend_debe_llamar() {
        List<String> funciones = jdbc.queryForList("""
                SELECT n.nspname || '.' || p.proname
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname IN ('orders','billing','geo','reputation','chat')
                  AND p.proname IN ('aceptar_oferta','rechazar_oferta','expirar_ofertas',
                                    'generar_cotizacion_inicial','responder_cotizacion',
                                    'obtener_comision_pct','recalcular_indice',
                                    'crear_particion_ubicaciones','marcar_leidos')
                ORDER BY 1
                """, String.class);

        assertThat(funciones).contains(
                "orders.aceptar_oferta",
                "orders.rechazar_oferta",
                "billing.generar_cotizacion_inicial",
                "billing.responder_cotizacion",
                "billing.obtener_comision_pct",
                "reputation.recalcular_indice");
    }
}

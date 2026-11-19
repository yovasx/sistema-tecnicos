package com.tecnicos.tecnicos_backend.shared.persistence;

import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import com.tecnicos.tecnicos_backend.orders.domain.EstadoOrden;
import com.tecnicos.tecnicos_backend.orders.domain.OrdenServicio;
import com.tecnicos.tecnicos_backend.orders.domain.TransicionEstado;
import com.tecnicos.tecnicos_backend.orders.infrastructure.CategoriaServicioRepository;
import com.tecnicos.tecnicos_backend.orders.infrastructure.OrdenServicioRepository;
import com.tecnicos.tecnicos_backend.orders.infrastructure.TransicionEstadoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prueba de la auditoría contra la base real: el trigger escribe en
 * {@code orders.transiciones_estado} leyendo {@code app.usuario_id}.
 *
 * <p>Si el contexto no se setea dentro de la transacción, el historial queda
 * sin usuario y la auditoría no sirve para nada. Este test lo vigila.</p>
 */
@SpringBootTest
@Transactional
class AuditoriaIntegrationTest {

    @Autowired
    private AuditoriaContexto auditoria;

    @Autowired
    private UsuarioRepository usuarios;

    @Autowired
    private CategoriaServicioRepository categorias;

    @Autowired
    private OrdenServicioRepository ordenes;

    @Autowired
    private TransicionEstadoRepository transiciones;

    private Long clienteId;
    private Integer categoriaId;

    @BeforeEach
    void preparar() {
        // Estado limpio: el ThreadLocal se reutiliza entre tests en el mismo hilo.
        auditoria.definirUsuario(null);

        clienteId = usuarios.findByEmailIgnoreCase("maria.quispe@ejemplo.bo")
                .orElseThrow(() -> new IllegalStateException("Falta el seed del cliente"))
                .getId();
        categoriaId = categorias.findByActivaTrueOrderById().get(0).getId();
    }

    @Test
    void la_auditoria_registra_al_usuario_real() {
        auditoria.definirUsuario(clienteId);
        auditoria.aplicarEnTransaccion();

        OrdenServicio orden = ordenes.save(nuevaOrden());

        List<TransicionEstado> historial =
                transiciones.findByOrdenIdOrderByRegistradoEnAsc(orden.getId());

        assertThat(historial).hasSize(1);
        assertThat(historial.getFirst().getEstadoNuevo()).isEqualTo(EstadoOrden.solicitado);
        assertThat(historial.getFirst().getEstadoAnterior()).isNull();
        assertThat(historial.getFirst().getUsuarioId())
                .as("el trigger debe leer app.usuario_id y no NULL")
                .isEqualTo(clienteId);
    }

    @Test
    void sin_contexto_no_se_inventa_un_usuario() {
        auditoria.definirUsuario(null);
        auditoria.aplicarEnTransaccion();

        OrdenServicio orden = ordenes.save(nuevaOrden());

        List<TransicionEstado> historial =
                transiciones.findByOrdenIdOrderByRegistradoEnAsc(orden.getId());

        assertThat(historial).hasSize(1);
        assertThat(historial.getFirst().getUsuarioId()).isNull();
    }

    private OrdenServicio nuevaOrden() {
        GeometryFactory fabrica = new GeometryFactory();
        Point ubicacion = fabrica.createPoint(new Coordinate(-68.1350, -16.4980));
        ubicacion.setSRID(4326);

        OrdenServicio orden = new OrdenServicio();
        orden.setCliente(usuarios.getReferenceById(clienteId));
        orden.setCategoria(categorias.getReferenceById(categoriaId));
        orden.setDescripcionFalla("La llave de la cocina gotea sin parar desde ayer.");
        orden.setUbicacionCliente(ubicacion);
        orden.setEstado(EstadoOrden.solicitado);
        orden.setTarifaUrgencia(false);
        return orden;
    }
}

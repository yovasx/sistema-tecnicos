package com.tecnicos.tecnicos_backend.orders.infrastructure;

import com.tecnicos.tecnicos_backend.orders.domain.TransicionEstado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransicionEstadoRepository extends JpaRepository<TransicionEstado, Long> {

    /** Timeline de la orden, en orden cronológico. Es la única fuente del historial. */
    List<TransicionEstado> findByOrdenIdOrderByRegistradoEnAsc(Long ordenId);
}

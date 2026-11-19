package com.tecnicos.tecnicos_backend.orders.infrastructure;

import com.tecnicos.tecnicos_backend.orders.domain.OfertaOrden;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OfertaOrdenRepository extends JpaRepository<OfertaOrden, Long> {

    Optional<OfertaOrden> findByOrdenIdAndTecnicoId(Long ordenId, Long tecnicoId);

    List<OfertaOrden> findByOrdenId(Long ordenId);
}

package com.tecnicos.tecnicos_backend.orders.infrastructure;

import com.tecnicos.tecnicos_backend.orders.domain.OrdenServicio;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrdenServicioRepository extends JpaRepository<OrdenServicio, Long> {
}

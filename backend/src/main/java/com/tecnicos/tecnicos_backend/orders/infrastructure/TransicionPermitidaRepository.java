package com.tecnicos.tecnicos_backend.orders.infrastructure;

import com.tecnicos.tecnicos_backend.orders.domain.TransicionPermitida;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransicionPermitidaRepository
        extends JpaRepository<TransicionPermitida, TransicionPermitida.Pk> {
}

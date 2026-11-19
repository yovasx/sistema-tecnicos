package com.tecnicos.tecnicos_backend.orders.infrastructure;

import com.tecnicos.tecnicos_backend.orders.domain.CategoriaServicio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoriaServicioRepository extends JpaRepository<CategoriaServicio, Integer> {

    List<CategoriaServicio> findByActivaTrueOrderById();
}

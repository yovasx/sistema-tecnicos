package com.tecnicos.tecnicos_backend.identity.infrastructure;

import com.tecnicos.tecnicos_backend.identity.domain.TecnicoEspecialidad;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TecnicoEspecialidadRepository
        extends JpaRepository<TecnicoEspecialidad, TecnicoEspecialidad.Pk> {
}

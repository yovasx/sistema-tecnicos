package com.tecnicos.tecnicos_backend.identity.infrastructure;

import com.tecnicos.tecnicos_backend.identity.domain.PerfilTecnico;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PerfilTecnicoRepository extends JpaRepository<PerfilTecnico, Long> {
}

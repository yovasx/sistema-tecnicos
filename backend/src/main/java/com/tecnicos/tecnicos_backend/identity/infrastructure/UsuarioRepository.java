package com.tecnicos.tecnicos_backend.identity.infrastructure;

import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    /** Búsqueda por email sin distinguir mayúsculas: la comparación es en la base. */
    Optional<Usuario> findByEmailIgnoreCase(String email);

    /** Evita emitir una sesión nueva con una contraseña que se está restableciendo. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_READ)
    @org.springframework.data.jpa.repository.Query("select u from Usuario u where lower(u.email)=lower(:email)")
    Optional<Usuario> buscarParaLogin(@org.springframework.data.repository.query.Param("email") String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByNit(String nit);

    long countByRol(RolUsuario rol);
}

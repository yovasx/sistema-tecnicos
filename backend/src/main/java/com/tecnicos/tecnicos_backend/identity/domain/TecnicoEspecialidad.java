package com.tecnicos.tecnicos_backend.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/**
 * identity.tecnico_especialidades
 *
 * <p>PK compuesta (tecnico_id, categoria_id). Se mapea con campos simples
 * para que Hibernate no necesite resolver entidades en la clave.</p>
 */
@Entity
@Table(name = "tecnico_especialidades", schema = "identity")
@IdClass(TecnicoEspecialidad.Pk.class)
public class TecnicoEspecialidad {

    @Id
    @Column(name = "tecnico_id")
    private Long tecnicoId;

    @Id
    @Column(name = "categoria_id")
    private Integer categoriaId;

    public static class Pk {
        private Long tecnicoId;
        private Integer categoriaId;

        public Pk() {
        }

        public Pk(Long tecnicoId, Integer categoriaId) {
            this.tecnicoId = tecnicoId;
            this.categoriaId = categoriaId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pk pk)) return false;
            return java.util.Objects.equals(tecnicoId, pk.tecnicoId)
                    && java.util.Objects.equals(categoriaId, pk.categoriaId);
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(tecnicoId, categoriaId);
        }
    }
}

package com.tecnicos.tecnicos_backend.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * orders.transiciones_permitidas
 *
 * <p>La máquina de estados vive en la base, no en Java. Cualquier cambio de
 * regla se hace con un INSERT/DELETE aquí y no requiere redeploy.</p>
 */
@Entity
@Table(name = "transiciones_permitidas", schema = "orders")
@IdClass(TransicionPermitida.Pk.class)
public class TransicionPermitida {

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Id
    @Column(name = "estado_origen")
    private EstadoOrden estadoOrigen;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Id
    @Column(name = "estado_destino")
    private EstadoOrden estadoDestino;

    public static class Pk {
        private EstadoOrden estadoOrigen;
        private EstadoOrden estadoDestino;

        public Pk() {
        }

        public Pk(EstadoOrden estadoOrigen, EstadoOrden estadoDestino) {
            this.estadoOrigen = estadoOrigen;
            this.estadoDestino = estadoDestino;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pk pk)) return false;
            return estadoOrigen == pk.estadoOrigen && estadoDestino == pk.estadoDestino;
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(estadoOrigen, estadoDestino);
        }
    }
}

package com.tecnicos.tecnicos_backend.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

/**
 * orders.transiciones_estado — historial auditable de la orden.
 *
 * <p>Lo llena un trigger. {@code usuario_id} sale de
 * {@code orders.usuario_actual()}, que lee {@code app.usuario_id}. Si no se
 * setea el contexto, queda NULL y el historial no sirve.</p>
 */
@Entity
@Table(name = "transiciones_estado", schema = "orders")
public class TransicionEstado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "estado_anterior")
    private EstadoOrden estadoAnterior;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "estado_nuevo", nullable = false)
    private EstadoOrden estadoNuevo;

    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(name = "observacion")
    private String observacion;

    @Column(name = "registrado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime registradoEn;

    public Long getId() {
        return id;
    }

    public Long getOrdenId() {
        return ordenId;
    }

    public EstadoOrden getEstadoAnterior() {
        return estadoAnterior;
    }

    public EstadoOrden getEstadoNuevo() {
        return estadoNuevo;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }
}

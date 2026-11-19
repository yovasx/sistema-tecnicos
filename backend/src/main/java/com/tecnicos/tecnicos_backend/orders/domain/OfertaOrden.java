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

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * orders.ofertas_orden
 *
 * <p>El índice único parcial {@code uq_oferta_aceptada} garantiza que solo una
 * oferta quede aceptada por orden. No hay columna de versión: eso es un
 * problema del trigger, no de Hibernate.</p>
 */
@Entity
@Table(name = "ofertas_orden", schema = "orders")
public class OfertaOrden {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "orden_id", nullable = false)
    private Long ordenId;

    @Column(name = "tecnico_id", nullable = false)
    private Long tecnicoId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "estado", nullable = false)
    private EstadoOferta estado;

    @Column(name = "distancia_metros", precision = 10, scale = 2)
    private BigDecimal distanciaMetros;

    @Column(name = "motivo_rechazo")
    private String motivoRechazo;

    @Column(name = "enviada_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime enviadaEn;

    @Column(name = "expira_en", nullable = false)
    private OffsetDateTime expiraEn;

    @Column(name = "respondida_en")
    private OffsetDateTime respondidaEn;

    public Long getId() {
        return id;
    }

    public Long getOrdenId() {
        return ordenId;
    }

    public Long getTecnicoId() {
        return tecnicoId;
    }

    public EstadoOferta getEstado() {
        return estado;
    }

    public OffsetDateTime getExpiraEn() {
        return expiraEn;
    }
}

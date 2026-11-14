package com.tecnicos.tecnicos_backend.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

/**
 * identity.perfiles_tecnico
 *
 * <p>PK = FK a usuarios. Las certificaciones son un arreglo TEXT[] en la base,
 * por eso se mapea como {@code String[]}.</p>
 */
@Entity
@Table(name = "perfiles_tecnico", schema = "identity")
public class PerfilTecnico {

    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    @OneToOne
    @MapsId
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(name = "documento_identidad_url")
    private String documentoIdentidadUrl;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "certificaciones_url", columnDefinition = "text[]")
    private String[] certificacionesUrl;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "estado_validacion", nullable = false)
    private EstadoValidacion estadoValidacion;

    @Column(name = "validado_por")
    private Long validadoPor;

    @Column(name = "fecha_validacion")
    private OffsetDateTime fechaValidacion;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "disponibilidad", nullable = false)
    private EstadoDisponibilidad disponibilidad;

    public Long getUsuarioId() {
        return usuarioId;
    }

    public EstadoValidacion getEstadoValidacion() {
        return estadoValidacion;
    }

    public EstadoDisponibilidad getDisponibilidad() {
        return disponibilidad;
    }
}

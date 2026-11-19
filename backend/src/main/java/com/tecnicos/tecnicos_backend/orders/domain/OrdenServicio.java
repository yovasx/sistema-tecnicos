package com.tecnicos.tecnicos_backend.orders.domain;

import com.tecnicos.tecnicos_backend.identity.domain.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.locationtech.jts.geom.Point;

import java.time.OffsetDateTime;

/**
 * orders.ordenes_servicio
 *
 * <p>La ubicación es PostGIS: geography(Point,4326). Hibernate Spatial la mapea
 * como {@link Point} de JTS.</p>
 */
@Entity
@Table(name = "ordenes_servicio", schema = "orders")
public class OrdenServicio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Usuario cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tecnico_id")
    private Usuario tecnico;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    private CategoriaServicio categoria;

    @Column(name = "descripcion_falla", nullable = false)
    private String descripcionFalla;

    @Column(name = "foto_evidencia_url")
    private String fotoEvidenciaUrl;

    /**
     * La columna es {@code geography(Point,4326)}. El código correcto es
     * {@link SqlTypes#GEOGRAPHY} (3250), que resuelve a {@code PGGeographyJdbcType}
     * de Hibernate Spatial. {@code SqlTypes#POINT} (3201) no está registrado y
     * Hibernate cae en {@code VarbinaryJdbcType}, que no sabe serializar un
     * {@link Point}: la escritura falla en tiempo de ejecución aunque el
     * {@code ddl-auto: validate} pase.
     */
    @JdbcTypeCode(SqlTypes.GEOGRAPHY)
    @Column(name = "ubicacion_cliente", nullable = false, columnDefinition = "geography(Point,4326)")
    private Point ubicacionCliente;

    @Column(name = "direccion_referencia")
    private String direccionReferencia;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "estado", nullable = false)
    private EstadoOrden estado;

    @Column(name = "tarifa_urgencia", nullable = false)
    private boolean tarifaUrgencia;

    @Column(name = "cancelado_por")
    private Long canceladoPor;

    @Column(name = "motivo_cancelacion")
    private String motivoCancelacion;

    @Column(name = "cancelado_en")
    private OffsetDateTime canceladoEn;

    @Column(name = "creado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "asignado_en")
    private OffsetDateTime asignadoEn;

    @Column(name = "llegada_estimada_en")
    private OffsetDateTime llegadaEstimadaEn;

    @Column(name = "llegada_en")
    private OffsetDateTime llegadaEn;

    @Column(name = "finalizado_en")
    private OffsetDateTime finalizadoEn;

    @Column(name = "actualizado_en", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime actualizadoEn;

    public Long getId() {
        return id;
    }

    public EstadoOrden getEstado() {
        return estado;
    }

    public Usuario getCliente() {
        return cliente;
    }

    public CategoriaServicio getCategoria() {
        return categoria;
    }

    public String getDescripcionFalla() {
        return descripcionFalla;
    }

    public void setCliente(Usuario cliente) {
        this.cliente = cliente;
    }

    public void setTecnico(Usuario tecnico) {
        this.tecnico = tecnico;
    }

    public void setCategoria(CategoriaServicio categoria) {
        this.categoria = categoria;
    }

    public void setDescripcionFalla(String descripcionFalla) {
        this.descripcionFalla = descripcionFalla;
    }

    public void setUbicacionCliente(Point ubicacionCliente) {
        this.ubicacionCliente = ubicacionCliente;
    }

    public void setEstado(EstadoOrden estado) {
        this.estado = estado;
    }

    public void setTarifaUrgencia(boolean tarifaUrgencia) {
        this.tarifaUrgencia = tarifaUrgencia;
    }
}

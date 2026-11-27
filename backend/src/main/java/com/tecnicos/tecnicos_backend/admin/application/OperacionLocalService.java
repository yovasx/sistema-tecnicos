package com.tecnicos.tecnicos_backend.admin.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class OperacionLocalService {
    public record Indicadores(long creadas,long asignadas,long sinAsignacion,long finalizadas,long canceladas,
        BigDecimal minutosAsignacion,BigDecimal minutosLlegada,long llegadas,long cotizacionesRespondidas,
        long cotizacionesAceptadas,long disputas,long cerradas) {}
    public record Pendiente(long orden,String categoria,String estado,String motivo,OffsetDateTime creadoEn) {}
    public record Panel(OffsetDateTime desde,OffsetDateTime hasta,Indicadores indicadores,List<Pendiente> pendientes) {}
    private final JdbcTemplate jdbc;
    public OperacionLocalService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Panel panel() {
        var hasta=OffsetDateTime.now(java.time.ZoneId.of("America/La_Paz"));
        var desde=hasta.minusDays(30);
        var indicadores=jdbc.queryForObject("""
            SELECT count(*) creadas,count(*) FILTER(WHERE asignado_en IS NOT NULL) asignadas,
                count(*) FILTER(WHERE tecnico_id IS NULL AND estado='solicitado') sin_asignacion,
                count(*) FILTER(WHERE estado='finalizado') finalizadas,
                count(*) FILTER(WHERE estado='cancelado') canceladas,
                avg(extract(epoch FROM asignado_en-creado_en)/60) minutos_asignacion,
                avg(extract(epoch FROM llegada_en-asignado_en)/60) minutos_llegada,
                count(*) FILTER(WHERE llegada_en IS NOT NULL AND asignado_en IS NOT NULL) llegadas,
                (SELECT count(*) FROM billing.cotizaciones q JOIN orders.ordenes_servicio x ON x.id=q.orden_id
                    WHERE x.creado_en>=? AND x.creado_en<? AND q.estado IN ('aceptada','rechazada')) respondidas,
                (SELECT count(*) FROM billing.cotizaciones q JOIN orders.ordenes_servicio x ON x.id=q.orden_id
                    WHERE x.creado_en>=? AND x.creado_en<? AND q.estado='aceptada') aceptadas,
                (SELECT count(DISTINCT d.orden_id) FROM admin_svc.disputas d JOIN orders.ordenes_servicio x ON x.id=d.orden_id
                    WHERE x.creado_en>=? AND x.creado_en<? AND x.estado IN ('finalizado','cancelado')) disputas,
                count(*) FILTER(WHERE estado IN ('finalizado','cancelado')) cerradas
            FROM orders.ordenes_servicio WHERE creado_en>=? AND creado_en<?
            """,(r,n)->new Indicadores(r.getLong("creadas"),r.getLong("asignadas"),r.getLong("sin_asignacion"),
                r.getLong("finalizadas"),r.getLong("canceladas"),r.getBigDecimal("minutos_asignacion"),r.getBigDecimal("minutos_llegada"),
                r.getLong("llegadas"),r.getLong("respondidas"),r.getLong("aceptadas"),r.getLong("disputas"),r.getLong("cerradas")),
                desde,hasta,desde,hasta,desde,hasta,desde,hasta);
        var pendientes=jdbc.query("""
            SELECT o.id,c.nombre,o.estado::text,o.creado_en,
                CASE WHEN a.incidencia IS NOT NULL THEN a.incidencia
                    WHEN a.conformidad='observado' THEN 'Entrega observada'
                    WHEN a.entregado_en<clock_timestamp()-interval '48 hours' AND a.conformidad='pendiente' THEN 'Conformidad pendiente por más de 48 horas'
                    WHEN a.pausa_motivo IS NOT NULL THEN 'Pausada: '||a.pausa_motivo
                    WHEN b.estado='sin_disponibilidad' THEN 'Búsqueda sin disponibilidad'
                    WHEN o.estado='en_camino' AND o.asignado_en<clock_timestamp()-interval '60 minutes' THEN 'Trayecto de más de 60 minutos: revisar, no es incumplimiento automático'
                    ELSE 'Solicitud por asignar' END motivo
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            LEFT JOIN orders.atenciones a ON a.orden_id=o.id LEFT JOIN orders.busquedas_servicio b ON b.orden_id=o.id
            WHERE o.estado NOT IN ('finalizado','cancelado') AND (o.estado='solicitado' OR a.incidencia IS NOT NULL
                OR a.pausa_motivo IS NOT NULL OR a.entregado_en IS NOT NULL
                OR (o.estado='en_camino' AND o.asignado_en<clock_timestamp()-interval '60 minutes'))
            ORDER BY (a.incidencia IS NOT NULL) DESC,o.creado_en,o.id LIMIT 50
            """,(r,n)->new Pendiente(r.getLong("id"),r.getString("nombre"),r.getString("estado"),r.getString("motivo"),r.getObject("creado_en",OffsetDateTime.class)));
        return new Panel(desde,hasta,indicadores,pendientes);
    }
}

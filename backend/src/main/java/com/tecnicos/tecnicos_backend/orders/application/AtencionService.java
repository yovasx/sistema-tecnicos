package com.tecnicos.tecnicos_backend.orders.application;

import com.tecnicos.tecnicos_backend.orders.api.AtencionDtos.*;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.time.*;
import java.util.*;

/** Orquesta funciones SQL; las decisiones y permisos se vuelven a validar bajo bloqueo. */
@Service
public class AtencionService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final AlmacenArchivos archivos;
    public AtencionService(JdbcTemplate jdbc,AuditoriaContexto auditoria,AlmacenArchivos archivos) {
        this.jdbc=jdbc;this.auditoria=auditoria;this.archivos=archivos;
    }
    private void participante(UsuarioAutenticado u,long orden) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM orders.ordenes_servicio o JOIN identity.usuarios u ON u.id=?
                WHERE o.id=? AND u.activo AND u.eliminado_en IS NULL
                AND (o.cliente_id=u.id OR o.tecnico_id=u.id OR u.rol='administrador'))
            """,Boolean.class,u.id(),orden))) throw new ApiException(HttpStatus.NOT_FOUND,"ATENCION_NO_DISPONIBLE","La atención no está disponible.");
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Atencion consultar(UsuarioAutenticado u,long orden) {
        participante(u,orden);
        var eventos=jdbc.query("""
            SELECT e.id,e.accion,e.motivo,e.creado_en,
                CASE WHEN u.eliminado_en IS NULL THEN nullif(concat_ws(' ',u.nombre,u.apellido),'') END actor
            FROM orders.eventos_atencion e LEFT JOIN identity.usuarios u ON u.id=e.actor_id
            WHERE e.orden_id=? ORDER BY e.id DESC LIMIT 50
            """,(r,n)->new Evento(r.getLong("id"),r.getString("accion"),r.getString("motivo"),r.getString("actor"),
                r.getObject("creado_en",OffsetDateTime.class)),orden);
        return jdbc.queryForObject("""
            SELECT a.*,o.estado::text,b.estado busqueda,b.hasta,b.intento,eq.nombre_snapshot,eq.sucursal_snapshot
            FROM orders.atenciones a JOIN orders.ordenes_servicio o ON o.id=a.orden_id
            LEFT JOIN orders.busquedas_servicio b ON b.orden_id=o.id
            LEFT JOIN orders.equipos_orden eq ON eq.orden_id=o.id WHERE o.id=?
            """,(r,n)->new Atencion(orden,r.getLong("revision"),r.getString("estado"),r.getString("busqueda"),
                r.getObject("hasta",OffsetDateTime.class),r.getInt("intento"),r.getString("pausa_motivo"),
                r.getObject("reanudar_en",OffsetDateTime.class),r.getString("incidencia"),
                r.getObject("llegada_verificada_en",OffsetDateTime.class),r.getString("trabajo_realizado"),
                r.getObject("entregado_en",OffsetDateTime.class),r.getString("conformidad"),r.getString("respuesta_cliente"),
                r.getObject("proximo_mantenimiento",LocalDate.class),r.getString("evidencia_url")!=null,
                r.getString("nombre_snapshot"),r.getString("sucursal_snapshot"),eventos),orden);
    }
    @Transactional public String codigo(long orden) {
        auditoria.aplicarEnTransaccion();
        return jdbc.queryForObject("SELECT orders.emitir_codigo_llegada(?)",String.class,orden);
    }
    @Transactional(noRollbackFor=ApiException.class)
    public void llegada(long orden,String codigo) {
        auditoria.aplicarEnTransaccion();
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT orders.verificar_llegada(?,?)",Boolean.class,orden,codigo)))
            throw new ApiException(HttpStatus.BAD_REQUEST,"CODIGO_LLEGADA_INVALIDO",
                "El código no es válido, venció o alcanzó cinco intentos. Pide al cliente que genere uno nuevo.");
    }
    @Transactional public void incidencia(long orden,Accion r) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT orders.gestionar_incidencia(?,?,?,?,?)",(rs,n)->null,
            orden,r.revision(),r.accion(),r.motivo(),r.fecha());
    }
    @Transactional public void resolver(long orden,Accion r) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT admin_svc.resolver_atencion(?,?,?,?,?)",(rs,n)->null,
            orden,r.revision(),r.accion(),r.motivo(),r.fecha());
    }
    @Transactional public void reintentar(long orden,long revision) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT orders.reintentar_busqueda(?,?)",(rs,n)->null,orden,revision);
    }
    @Transactional(rollbackFor=IOException.class)
    public void entregar(long orden,long revision,String trabajo,LocalDate mantenimiento,MultipartFile evidencia) throws IOException {
        auditoria.aplicarEnTransaccion();
        // Bloquear y verificar antes de escribir el archivo, y compensar cualquier rollback.
        jdbc.queryForObject("SELECT orders.bloquear_atencion(?,?)",(rs,n)->null,orden,revision);
        if(evidencia==null) throw new ApiException(HttpStatus.BAD_REQUEST,"EVIDENCIA_REQUERIDA","Adjunta una evidencia del trabajo.");
        SolicitudesService.validarArchivo(evidencia);
        String url;
        try(var entrada=evidencia.getInputStream()) { url=archivos.guardar(evidencia.getOriginalFilename(),entrada); }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int estado) { if(estado!=STATUS_COMMITTED) archivos.eliminar(url); }
        });
        jdbc.queryForObject("SELECT orders.entregar_trabajo(?,?,?,?,?)",(rs,n)->null,orden,revision,trabajo,url,mantenimiento);
    }
    @Transactional public void conformidad(long orden,Conformidad r) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT orders.responder_entrega(?,?,?,?)",(rs,n)->null,
            orden,r.revision(),r.conforme(),r.comentario());
    }
    @Transactional(readOnly=true)
    public InputStream evidencia(UsuarioAutenticado u,long orden) throws IOException {
        participante(u,orden);
        String url=jdbc.queryForObject("SELECT evidencia_url FROM orders.atenciones WHERE orden_id=?",String.class,orden);
        if(url==null) throw new ApiException(HttpStatus.NOT_FOUND,"EVIDENCIA_NO_DISPONIBLE","La evidencia no está disponible.");
        return archivos.abrir(url);
    }
    @Transactional(readOnly=true)
    public List<Candidato> candidatos(long orden) {
        return jdbc.query("""
            SELECT p.usuario_id,concat_ws(' ',u.nombre,u.apellido) nombre,c.nombre especialidad,
                EXISTS(SELECT 1 FROM geo.zonas_cobertura z WHERE z.tecnico_id=u.id AND z.activo
                    AND ST_Covers(z.poligono::geometry,o.ubicacion_cliente::geometry)) cobertura,
                p.disponibilidad='disponible' disponible,
                NOT EXISTS(SELECT 1 FROM orders.ordenes_servicio a WHERE a.tecnico_id=u.id
                    AND a.estado NOT IN ('finalizado','cancelado')) sin_servicio,
                CASE WHEN ub.actualizado_en>clock_timestamp()-interval '30 seconds'
                    THEN ST_Distance(ub.punto,o.ubicacion_cliente) END distancia,
                coalesce(ir.indice_general,50) reputacion,
                (SELECT max(asignado_en) FROM orders.ordenes_servicio WHERE tecnico_id=u.id) ultima
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            JOIN identity.tecnico_especialidades e ON e.categoria_id=o.categoria_id
            JOIN identity.usuarios u ON u.id=e.tecnico_id AND u.activo AND u.eliminado_en IS NULL
            JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id AND p.estado_validacion='aprobado'
            LEFT JOIN reputation.indices_reputacion ir ON ir.tecnico_id=u.id
            LEFT JOIN geo.ubicacion_actual ub ON ub.tecnico_id=u.id WHERE o.id=?
            ORDER BY cobertura DESC,disponible DESC,sin_servicio DESC,distancia NULLS LAST,reputacion DESC,ultima NULLS FIRST,u.id LIMIT 30
            """,(r,n)->new Candidato(r.getLong("usuario_id"),r.getString("nombre"),r.getString("especialidad"),
                r.getBoolean("cobertura"),r.getBoolean("disponible"),r.getBoolean("sin_servicio"),
                r.getBigDecimal("distancia"),r.getBigDecimal("reputacion"),r.getObject("ultima",OffsetDateTime.class)),orden);
    }
}

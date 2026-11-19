package com.tecnicos.tecnicos_backend.admin.application;

import com.tecnicos.tecnicos_backend.admin.api.OrdenesAdminDtos.*;
import com.tecnicos.tecnicos_backend.orders.domain.EstadoOrden;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class OrdenesAdminService {
    private static final ZoneId BOLIVIA=ZoneId.of("America/La_Paz");
    private static final String BASE="""
        FROM orders.ordenes_servicio o
        JOIN orders.categorias_servicio c ON c.id=o.categoria_id
        LEFT JOIN identity.usuarios cl ON cl.id=o.cliente_id
        LEFT JOIN identity.usuarios t ON t.id=o.tecnico_id
        """;
    private static final String RESUMEN="""
        SELECT o.id,o.categoria_id,c.nombre AS categoria_nombre,o.estado::text,
            o.tarifa_urgencia,o.creado_en,
        """+columnasPersona("cl","cliente")+","+columnasPersona("t","tecnico");
    private final JdbcTemplate jdbc;

    public OrdenesAdminService(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    /** Conteo y página comparten snapshot. No se bloquean órdenes ni se escribe auditoría. */
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Pagina<Fila> listar(String busqueda,String estado,Integer categoria,String asignacion,
                               String desde,String hasta,int pagina,int tamano) {
        validarPagina(pagina,tamano);
        if(busqueda.length()>150 || (categoria!=null && categoria<1)
                || !Set.of("todos","asignada","sin_asignar").contains(asignacion)) throw filtros();
        if(!estado.equals("todos")) {
            try { EstadoOrden.valueOf(estado); }
            catch(IllegalArgumentException ex) { throw filtros(); }
        }
        LocalDate inicio=fecha(desde),fin=fecha(hasta);
        if(inicio!=null && fin!=null && inicio.isAfter(fin)) throw filtros();
        List<Object> args=new ArrayList<>();
        String where=" WHERE TRUE ";
        String texto=busqueda.trim();
        if(!texto.isEmpty()) {
            if(texto.matches("[0-9]+")) {
                try { args.add(Long.parseLong(texto)); where+=" AND o.id=?"; }
                catch(NumberFormatException ex) { where+=" AND FALSE"; }
            } else {
                where+="""
                    AND (position(lower(?) in lower(CASE WHEN cl.eliminado_en IS NULL
                          THEN concat_ws(' ',cl.nombre,cl.apellido) ELSE '' END))>0
                      OR position(lower(?) in lower(CASE WHEN t.eliminado_en IS NULL
                          THEN concat_ws(' ',t.nombre,t.apellido) ELSE '' END))>0)
                    """;
                args.add(texto); args.add(texto);
            }
        }
        if(!estado.equals("todos")) { where+=" AND o.estado=?::orders.estado_orden"; args.add(estado); }
        if(categoria!=null) { where+=" AND o.categoria_id=?"; args.add(categoria); }
        if(asignacion.equals("asignada")) where+=" AND o.tecnico_id IS NOT NULL";
        if(asignacion.equals("sin_asignar")) where+=" AND o.tecnico_id IS NULL";
        if(inicio!=null) { where+=" AND o.creado_en>=?"; args.add(inicio.atStartOfDay(BOLIVIA).toOffsetDateTime()); }
        if(fin!=null) { where+=" AND o.creado_en<?"; args.add(fin.plusDays(1).atStartOfDay(BOLIVIA).toOffsetDateTime()); }
        long total=jdbc.queryForObject("SELECT count(*) "+BASE+where,Long.class,args.toArray());
        args.add(tamano); args.add(pagina*tamano);
        var filas=jdbc.query(RESUMEN+" "+BASE+where+" ORDER BY o.creado_en DESC,o.id DESC LIMIT ? OFFSET ?",
            (r,n)->new Fila(r.getLong("id"),categoria(r),persona(r,"cliente"),persona(r,"tecnico"),
                r.getString("estado"),r.getBoolean("tarifa_urgencia"),instante(r,"creado_en")),args.toArray());
        return new Pagina<>(filas,total,pagina,tamano);
    }

    @Transactional(readOnly=true)
    public Detalle detalle(long id) {
        validarId(id);
        var filas=jdbc.query(RESUMEN+"""
            ,cl.email AS cliente_email,cl.telefono AS cliente_telefono,
            t.email AS tecnico_email,t.telefono AS tecnico_telefono,
            o.descripcion_falla,o.direccion_referencia,
            ST_Y(o.ubicacion_cliente::geometry) AS latitud,
            ST_X(o.ubicacion_cliente::geometry) AS longitud,
            o.asignado_en,o.llegada_estimada_en,o.llegada_en,o.finalizado_en,o.actualizado_en,
            o.motivo_cancelacion,o.cancelado_en,
            """+columnasPersona("a","autor")+" "+BASE+"""
             LEFT JOIN identity.usuarios a ON a.id=o.cancelado_por WHERE o.id=?
            """,(r,n)->new Detalle(r.getLong("id"),categoria(r),contacto(r,"cliente"),contacto(r,"tecnico"),
                r.getString("estado"),r.getBoolean("tarifa_urgencia"),r.getString("descripcion_falla"),
                r.getString("direccion_referencia"),new Ubicacion(r.getDouble("latitud"),r.getDouble("longitud")),
                instante(r,"creado_en"),instante(r,"asignado_en"),instante(r,"llegada_estimada_en"),
                instante(r,"llegada_en"),instante(r,"finalizado_en"),instante(r,"actualizado_en"),
                r.getString("estado").equals("cancelado")
                    ? new Cancelacion(r.getString("motivo_cancelacion"),persona(r,"autor"),instante(r,"cancelado_en"))
                    : null),id);
        if(filas.isEmpty()) throw noEncontrada();
        return filas.getFirst();
    }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Pagina<Transicion> historial(long id,int pagina,int tamano) {
        validarId(id); validarPagina(pagina,tamano);
        if(!Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM orders.ordenes_servicio WHERE id=?)",Boolean.class,id))) throw noEncontrada();
        long total=jdbc.queryForObject(
            "SELECT count(*) FROM orders.transiciones_estado WHERE orden_id=?",Long.class,id);
        var filas=jdbc.query("""
            SELECT h.id,h.estado_anterior::text,h.estado_nuevo::text,h.observacion,h.registrado_en,
            """+columnasPersona("u","autor")+"""
             FROM orders.transiciones_estado h LEFT JOIN identity.usuarios u ON u.id=h.usuario_id
             WHERE h.orden_id=? ORDER BY h.registrado_en DESC,h.id DESC LIMIT ? OFFSET ?
            """,(r,n)->new Transicion(r.getLong("id"),r.getString("estado_anterior"),r.getString("estado_nuevo"),
                persona(r,"autor"),r.getString("observacion"),instante(r,"registrado_en")),id,tamano,pagina*tamano);
        return new Pagina<>(filas,total,pagina,tamano);
    }

    private static String columnasPersona(String tabla,String prefijo) {
        return tabla+".id AS "+prefijo+"_id,concat_ws(' ',"+tabla+".nombre,"+tabla+".apellido) AS "+prefijo
            +"_nombre,"+tabla+".activo AS "+prefijo+"_activo,"+tabla+".eliminado_en AS "+prefijo+"_eliminado_en";
    }
    private static Persona persona(ResultSet r,String prefijo) throws SQLException {
        Long id=r.getObject(prefijo+"_id",Long.class);
        if(id==null) return null;
        boolean eliminada=r.getObject(prefijo+"_eliminado_en")!=null;
        return new Persona(eliminada?null:id,eliminada?"Cuenta eliminada":r.getString(prefijo+"_nombre"),
            !eliminada && r.getBoolean(prefijo+"_activo"),eliminada);
    }
    private static Contacto contacto(ResultSet r,String prefijo) throws SQLException {
        var persona=persona(r,prefijo);
        if(persona==null) return null;
        return new Contacto(persona,persona.eliminada()?null:r.getString(prefijo+"_email"),
            persona.eliminada()?null:r.getString(prefijo+"_telefono"));
    }
    private static Categoria categoria(ResultSet r) throws SQLException {
        return new Categoria(r.getInt("categoria_id"),r.getString("categoria_nombre"));
    }
    private static OffsetDateTime instante(ResultSet r,String nombre) throws SQLException {
        return r.getObject(nombre,OffsetDateTime.class);
    }
    private static LocalDate fecha(String valor) {
        if(valor.isEmpty()) return null;
        if(!valor.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw filtros();
        try {
            LocalDate fecha=LocalDate.parse(valor);
            if(fecha.getYear()<1) throw filtros();
            return fecha;
        } catch(DateTimeParseException ex) { throw filtros(); }
    }
    private static void validarPagina(int pagina,int tamano) {
        if(pagina<0 || pagina>100000 || tamano<1 || tamano>100) throw filtros();
    }
    private static void validarId(long id) {
        if(id<1) throw new ApiException(HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","El ID debe ser positivo.");
    }
    private static ApiException filtros() {
        return new ApiException(HttpStatus.BAD_REQUEST,"FILTROS_INVALIDOS","Revisá los filtros, las fechas y la página de órdenes.");
    }
    private static ApiException noEncontrada() {
        return new ApiException(HttpStatus.NOT_FOUND,"ORDEN_NO_ENCONTRADA","La orden no existe.");
    }
}

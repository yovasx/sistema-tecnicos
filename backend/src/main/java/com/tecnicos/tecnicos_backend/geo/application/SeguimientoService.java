package com.tecnicos.tecnicos_backend.geo.application;

import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.Instant;
import java.util.HexFormat;

/** La orden es el límite de autorización; no existe directorio de posiciones. */
@Service
public class SeguimientoService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final SecureRandom azar = new SecureRandom();
    public SeguimientoService(JdbcTemplate jdbc, AuditoriaContexto auditoria) {
        this.jdbc=jdbc; this.auditoria=auditoria;
    }
    public record Acceso(long usuario, long orden, long version, Instant vence) {}
    public record Punto(double latitud, double longitud, Float precision, OffsetDateTime actualizadoEn) {}
    public record FichaTecnico(String nombre, String fotoUrl, Double promedio, long totalCalificaciones) {}
    public record Vista(long orden, String estado, String tecnico, Punto posicion,
                        Integer etaMinutos, boolean vigente, FichaTecnico fichaTecnico) {}
    public record Ticket(String ticket) {
        @Override public String toString() { return "Ticket[protegido]"; }
    }
    @Transactional(readOnly=true)
    public Vista consultar(long usuario, long orden) {
        return snapshot(usuario, orden, null);
    }
    @Transactional(readOnly=true)
    public Vista consultar(Acceso acceso) {
        if(!acceso.vence().isAfter(Instant.now())) throw noDisponible();
        return snapshot(acceso.usuario(), acceso.orden(), acceso.version());
    }
    private Vista snapshot(long usuario, long orden, Long version) {
        var filas=jdbc.query("""
            SELECT o.id,o.estado::text, u.version_sesion,
              CASE WHEN t.id IS NOT NULL AND t.eliminado_en IS NULL THEN concat_ws(' ',t.nombre,t.apellido) END tecnico,
              CASE WHEN t.activo AND t.eliminado_en IS NULL THEN t.foto_perfil_url END foto,
              rep.promedio,rep.total,
              ST_Y(g.punto::geometry) latitud,ST_X(g.punto::geometry) longitud,
              g.precision_m,g.actualizado_en,
              CASE WHEN g.actualizado_en>clock_timestamp()-interval '30 seconds'
                THEN LEAST(32767, GREATEST(1,ceil(ST_Distance(g.punto,o.ubicacion_cliente)*1.35/333.33)))::int END eta
            FROM orders.ordenes_servicio o
            JOIN identity.usuarios u ON u.id=? AND u.activo AND u.eliminado_en IS NULL
            LEFT JOIN identity.usuarios t ON t.id=o.tecnico_id
            LEFT JOIN LATERAL (
              SELECT avg(puntaje)::float8 promedio,count(*) total FROM reputation.calificaciones
              WHERE calificado_id=t.id
            ) rep ON TRUE
            LEFT JOIN geo.ubicacion_actual g ON g.orden_id=o.id AND g.tecnico_id=o.tecnico_id
              AND o.estado='en_camino' AND t.activo AND t.eliminado_en IS NULL
            WHERE o.id=? AND (o.cliente_id=u.id OR o.tecnico_id=u.id)
            """,(r,n)-> {
                if (version!=null && version!=r.getLong("version_sesion")) throw noDisponible();
                var fecha=r.getObject("actualizado_en",OffsetDateTime.class);
                boolean vigente=fecha!=null && fecha.isAfter(OffsetDateTime.now().minusSeconds(30));
                return new Vista(r.getLong("id"),r.getString("estado"),r.getString("tecnico"),
                    fecha==null?null:new Punto(r.getDouble("latitud"),r.getDouble("longitud"),
                        r.getObject("precision_m",Float.class),fecha),
                    r.getObject("eta",Integer.class),vigente,
                    r.getString("tecnico")==null?null:new FichaTecnico(r.getString("tecnico"),
                        avatar(r.getString("foto")),r.getObject("promedio",Double.class),r.getLong("total")));
            },usuario,orden);
        if(filas.isEmpty()) throw noDisponible();
        return filas.getFirst();
    }
    @Transactional
    public Ticket emitir(long usuario,long orden,Instant vence,long version) {
        auditoria.aplicarEnTransaccion();
        if(vence==null || !vence.isAfter(Instant.now())) throw noDisponible();
        var vista=snapshot(usuario,orden,null);
        if(!vista.estado().equals("en_camino")) throw noDisponible();
        // Límite por cuenta también entre varias instancias.
        var versiones=jdbc.queryForList("""
            SELECT version_sesion FROM identity.usuarios
            WHERE id=? AND activo AND eliminado_en IS NULL FOR UPDATE
            """,Long.class,usuario);
        if(versiones.isEmpty() || versiones.getFirst()!=version) throw noDisponible();
        if(jdbc.queryForObject("""
            SELECT count(*) FROM identity.tickets_seguimiento
            WHERE usuario_id=? AND creado_en>clock_timestamp()-interval '1 minute'
            """,Long.class,usuario)>=20)
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"LIMITE_SEGUIMIENTO","Espera un momento antes de reconectar.");
        byte[] bytes=new byte[32]; azar.nextBytes(bytes);
        // La expiración original del JWT queda vinculada al hash del ticket,
        // incluso si otra instancia consume el permiso.
        String ticket=Long.toHexString(vence.getEpochSecond())+"."+Long.toHexString(version)
            +"."+HexFormat.of().formatHex(bytes);
        jdbc.update("""
            INSERT INTO identity.tickets_seguimiento(hash,usuario_id,orden_id,expira_en)
            VALUES(?,?,?,clock_timestamp()+interval '60 seconds')
            """,hash(ticket),usuario,orden);
        return new Ticket(ticket);
    }
    @Transactional
    public Acceso consumir(String ticket) {
        if(ticket==null || !ticket.matches("[a-f0-9]{8,12}\\.[a-f0-9]{1,15}\\.[a-f0-9]{64}")) throw noDisponible();
        var partes=ticket.split("\\.");
        Instant vence=Instant.ofEpochSecond(Long.parseLong(partes[0],16));
        long version=Long.parseLong(partes[1],16);
        if(!vence.isAfter(Instant.now())) throw noDisponible();
        var filas=jdbc.query("""
            UPDATE identity.tickets_seguimiento k SET usado_en=clock_timestamp()
            FROM identity.usuarios u
            WHERE k.hash=? AND k.usuario_id=u.id AND k.usado_en IS NULL
              AND k.expira_en>clock_timestamp() AND u.activo AND u.eliminado_en IS NULL
              AND u.version_sesion=?
            RETURNING k.usuario_id,k.orden_id,u.version_sesion
            """,(r,n)->new Acceso(r.getLong(1),r.getLong(2),r.getLong(3),vence),hash(ticket),version);
        if(filas.isEmpty()) throw noDisponible();
        var acceso=filas.getFirst();
        if(!consultar(acceso).estado().equals("en_camino")) throw noDisponible();
        return acceso;
    }
    @Transactional
    public void reportar(long tecnico,long orden,double lat,double lng,Float precision) {
        auditoria.aplicarEnTransaccion();
        if(!Double.isFinite(lat)||Math.abs(lat)>90 || !Double.isFinite(lng)||Math.abs(lng)>180
            || precision!=null && (!Float.isFinite(precision)||precision<0||precision>10000))
            throw new ApiException(HttpStatus.BAD_REQUEST,"UBICACION_INVALIDA","Revisa las coordenadas y su precisión.");
        var filas=jdbc.queryForList("""
            SELECT o.id FROM orders.ordenes_servicio o
            JOIN identity.perfiles_tecnico p ON p.usuario_id=o.tecnico_id
            JOIN identity.usuarios u ON u.id=p.usuario_id AND u.activo AND u.eliminado_en IS NULL
            WHERE o.id=? AND o.tecnico_id=? AND o.estado='en_camino'
              AND p.estado_validacion='aprobado' FOR UPDATE OF o,u
            """,orden,tecnico);
        if(filas.isEmpty()) throw noDisponible();
        var ultima=jdbc.queryForList("""
            SELECT actualizado_en FROM geo.ubicacion_actual WHERE tecnico_id=?
              AND actualizado_en>clock_timestamp()-interval '3 seconds'
            """,tecnico);
        if(!ultima.isEmpty()) return;
        // Las particiones históricas no se generan solas al cambiar de mes.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(841913)",(r,n)->null);
        jdbc.queryForObject("SELECT geo.crear_particion_ubicaciones(CURRENT_DATE)",String.class);
        jdbc.queryForObject("SELECT geo.reportar_ubicacion_tecnico(?,?,?, ?,?::real)",
            (r,n)->null,tecnico,orden,lat,lng,precision);
    }
    static String hash(String valor) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(valor.getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    private static String avatar(String ruta) {
        return ruta!=null && ruta.matches("/perfiles/[a-f0-9-]{36}\\.(png|jpg|jpeg)")
            ? "/api/avatares/"+ruta.substring("/perfiles/".length()):null;
    }
    private static ApiException noDisponible() {
        return new ApiException(HttpStatus.NOT_FOUND,"SEGUIMIENTO_NO_DISPONIBLE","El seguimiento no está disponible.");
    }
}

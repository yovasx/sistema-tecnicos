package com.tecnicos.tecnicos_backend.chat.application;

import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import com.tecnicos.tecnicos_backend.orders.api.SolicitudesDtos.Pagina;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class ComunicacionService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    public ComunicacionService(JdbcTemplate jdbc,AuditoriaContexto auditoria) { this.jdbc=jdbc; this.auditoria=auditoria; }
    public record Notificacion(long id,Long orden,String tipo,String mensaje,boolean leido,OffsetDateTime enviadoEn) {}
    public record Mensaje(long id,boolean propio,String tipo,String contenido,boolean contieneContacto,OffsetDateTime enviadoEn) {}
    public record Conversacion(boolean abierta,List<Mensaje> mensajes,boolean hayAnteriores) {}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Pagina<Notificacion> notificaciones(long usuario,int pagina) {
        if(pagina<0 || pagina>100000) throw new ApiException(HttpStatus.BAD_REQUEST,"PAGINA_INVALIDA","La página no es válida.");
        long total=jdbc.queryForObject("SELECT count(*) FROM notification.notificaciones WHERE usuario_id=?",Long.class,usuario);
        var datos=jdbc.query("""
            SELECT id,orden_id,tipo::text,mensaje,leido,enviado_en FROM notification.notificaciones
            WHERE usuario_id=? ORDER BY id DESC LIMIT 20 OFFSET ?
            """,(r,n)->new Notificacion(r.getLong(1),r.getObject(2,Long.class),r.getString(3),r.getString(4),
                r.getBoolean(5),r.getObject(6,OffsetDateTime.class)),usuario,pagina*20);
        return new Pagina<>(datos,total,pagina,20);
    }
    @Transactional public void leer(long usuario,long id) {
        auditoria.aplicarEnTransaccion();
        if(jdbc.update("UPDATE notification.notificaciones SET leido=true WHERE id=? AND usuario_id=?",id,usuario)==0) throw ausente();
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Conversacion mensajes(long usuario,long orden,long antes) {
        var conversaciones=jdbc.queryForList("""
            SELECT abierta FROM chat.conversaciones WHERE orden_id=? AND ? IN (cliente_id,tecnico_id)
            """,Boolean.class,orden,usuario);
        if(conversaciones.isEmpty()) throw ausente();
        var mensajes=jdbc.query("""
            SELECT m.id,m.emisor_id=? propio,m.tipo::text,m.contenido,m.contiene_contacto,m.enviado_en
            FROM chat.mensajes m JOIN chat.conversaciones c ON c.id=m.conversacion_id
            WHERE c.orden_id=? AND (?=0 OR m.id<?) ORDER BY m.id DESC LIMIT 51
            """,(r,n)->new Mensaje(r.getLong(1),r.getBoolean(2),r.getString(3),
                r.getString(3).equals("imagen")?"Archivo adjunto anterior":r.getString(4),
                r.getBoolean(5),r.getObject(6,OffsetDateTime.class)),usuario,orden,antes,antes);
        boolean mas=mensajes.size()>50;
        return new Conversacion(conversaciones.getFirst(),mensajes.stream().limit(50).toList().reversed(),mas);
    }
    @Transactional public long enviar(long orden,UUID clave,String contenido) {
        auditoria.aplicarEnTransaccion();
        return jdbc.queryForObject("SELECT chat.enviar_mensaje_propio(?,?::uuid,?)",Long.class,orden,clave.toString(),contenido);
    }
    private ApiException ausente() { return new ApiException(HttpStatus.NOT_FOUND,"CONVERSACION_NO_DISPONIBLE","El contenido no está disponible."); }
}

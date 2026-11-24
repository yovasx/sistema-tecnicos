package com.tecnicos.tecnicos_backend.geo.infrastructure;

import com.tecnicos.tecnicos_backend.geo.application.SeguimientoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import java.util.concurrent.ConcurrentHashMap;
import java.io.IOException;
import org.springframework.web.socket.adapter.NativeWebSocketSession;

/**
 * WebSocket nativo, sin JWT/ticket en URL ni cambio de autenticación HTTP.
 * Cada instancia lee snapshots confirmados: reconexión y varias instancias
 * conservan la misma fuente de verdad, sin depender de eventos volátiles.
 */
@Configuration
@EnableWebSocket
@EnableScheduling
public class SeguimientoSocket extends TextWebSocketHandler implements WebSocketConfigurer {
    private final SeguimientoService servicio;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final String[] origenes;
    private final ConcurrentHashMap<String,Conexion> conexiones=new ConcurrentHashMap<>();
    private static class Conexion {
        final WebSocketSession sesion;
        final long abierta=System.currentTimeMillis();
        volatile SeguimientoService.Acceso acceso;
        Conexion(WebSocketSession s) { sesion=s; }
    }
    public SeguimientoSocket(SeguimientoService servicio,JdbcTemplate jdbc,ObjectMapper json,
        @Value("${CORS_ALLOWED_ORIGINS:http://localhost:9081,http://127.0.0.1:9081}") String origenes) {
        this.servicio=servicio; this.jdbc=jdbc; this.json=json; this.origenes=origenes.split("\\s*,\\s*");
    }
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registro) {
        registro.addHandler(this,"/api/ws/seguimiento").setAllowedOrigins(origenes);
    }
    @Override public void afterConnectionEstablished(WebSocketSession sesion) throws Exception {
        sesion.setTextMessageSizeLimit(1024);
        if(sesion instanceof NativeWebSocketSession nativa) {
            var n=nativa.getNativeSession(jakarta.websocket.Session.class);
            if(n!=null) {
                n.setMaxIdleTimeout(60000); n.getAsyncRemote().setSendTimeout(5000);
                n.getUserProperties().put("org.apache.tomcat.websocket.BLOCKING_SEND_TIMEOUT",5000L);
            }
        }
        if(conexiones.size()>=500) { sesion.close(CloseStatus.SERVICE_OVERLOAD); return; }
        conexiones.put(sesion.getId(),new Conexion(sesion));
    }
    @Override protected void handleTextMessage(WebSocketSession sesion,TextMessage mensaje) throws Exception {
        Conexion c=conexiones.get(sesion.getId());
        if(c==null) { sesion.close(CloseStatus.POLICY_VIOLATION); return; }
        if(c.acceso!=null) return; // El canal no admite acciones ni publicación del cliente.
        try {
            var acceso=servicio.consumir(json.readTree(mensaje.getPayload()).path("ticket").asString());
            if(conexiones.values().stream().filter(v->v.acceso!=null && v.acceso.usuario()==acceso.usuario()).count()>=3)
                throw new IllegalStateException();
            c.acceso=acceso;
        } catch(Exception ex) { cerrar(c); }
    }
    @Override public void afterConnectionClosed(WebSocketSession s,CloseStatus estado) { conexiones.remove(s.getId()); }
    @Override public void handleTransportError(WebSocketSession s,Throwable error) {
        var c=conexiones.get(s.getId()); if(c!=null) cerrar(c);
    }
    @Scheduled(fixedDelay=3000)
    public void publicar() {
        for(var c:conexiones.values()) {
            if(c.acceso==null) {
                if(System.currentTimeMillis()-c.abierta>5000) cerrar(c);
                continue;
            }
            try {
                var vista=servicio.consultar(c.acceso);
                synchronized(c) {
                    // Límite de envío en el contenedor; no mantener buffers sin límite.
                    if(c.sesion.isOpen()) c.sesion.sendMessage(new TextMessage(json.writeValueAsString(vista)));
                }
                if(!vista.estado().equals("en_camino")) cerrar(c);
            } catch(Exception ex) { cerrar(c); }
        }
    }
    @Scheduled(fixedDelay=60000,initialDelay=10000)
    public void limpiar() {
        jdbc.update("""
            UPDATE geo.sesiones_seguimiento s SET cerrada_en=clock_timestamp()
            WHERE cerrada_en IS NULL AND (expira_en<=clock_timestamp() OR NOT EXISTS(
                SELECT 1 FROM identity.usuarios u WHERE u.id=s.tecnico_id AND u.activo
                    AND u.eliminado_en IS NULL AND u.version_sesion=s.version_sesion))
            """);
        jdbc.update("""
            DELETE FROM geo.ubicacion_actual g WHERE g.orden_id IS NOT NULL AND NOT EXISTS(
                SELECT 1 FROM geo.sesiones_seguimiento s WHERE s.tecnico_id=g.tecnico_id AND s.orden_id=g.orden_id
                    AND s.cerrada_en IS NULL AND s.expira_en>clock_timestamp())
            """);
        jdbc.update("""
            DELETE FROM geo.ubicacion_actual g WHERE g.orden_id IS NOT NULL AND NOT EXISTS(
                SELECT 1 FROM orders.ordenes_servicio o JOIN identity.usuarios u ON u.id=o.tecnico_id
                WHERE o.id=g.orden_id AND o.tecnico_id=g.tecnico_id AND o.estado='en_camino'
                    AND u.activo AND u.eliminado_en IS NULL)
            """);
        jdbc.update("DELETE FROM identity.tickets_seguimiento WHERE expira_en<clock_timestamp()");
        jdbc.queryForObject("SELECT geo.purgar_ubicaciones(30)",Long.class);
        jdbc.update("DELETE FROM geo.sesiones_seguimiento WHERE cerrada_en<clock_timestamp()-interval '30 days'");
    }
    private void cerrar(Conexion c) {
        conexiones.remove(c.sesion.getId());
        try { c.sesion.close(CloseStatus.POLICY_VIOLATION); } catch(IOException ignored) { }
    }
}

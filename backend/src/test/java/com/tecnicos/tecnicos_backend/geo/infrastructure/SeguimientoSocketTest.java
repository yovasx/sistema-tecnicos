package com.tecnicos.tecnicos_backend.geo.infrastructure;

import com.tecnicos.tecnicos_backend.geo.application.SeguimientoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.socket.*;
import tools.jackson.databind.ObjectMapper;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;

class SeguimientoSocketTest {
    SeguimientoService servicio;
    SeguimientoSocket socket;
    WebSocketSession sesion;
    @BeforeEach void preparar() throws Exception {
        servicio=mock(SeguimientoService.class);
        socket=new SeguimientoSocket(servicio,mock(JdbcTemplate.class),new ObjectMapper(),"http://localhost:9081");
        sesion=mock(WebSocketSession.class);
        when(sesion.getId()).thenReturn("conexion");
        when(sesion.isOpen()).thenReturn(true);
        socket.afterConnectionEstablished(sesion);
    }
    @Test void no_publica_datos_antes_del_ticket() throws Exception {
        socket.publicar();
        verifyNoInteractions(servicio);
        verify(sesion,never()).sendMessage(any());
    }
    @Test void ticket_invalido_cierra_sin_publicar() throws Exception {
        when(servicio.consumir("invalido")).thenThrow(new IllegalArgumentException());
        socket.handleTextMessage(sesion,new TextMessage("{\"ticket\":\"invalido\"}"));
        socket.publicar();
        verify(sesion).close(CloseStatus.POLICY_VIOLATION);
        verify(sesion,never()).sendMessage(any());
    }
    @Test void cada_snapshot_revalida_usuario_orden_y_version() throws Exception {
        var acceso=new SeguimientoService.Acceso(2,42,7,java.time.Instant.now().plusSeconds(60));
        when(servicio.consumir("permiso")).thenReturn(acceso);
        when(servicio.consultar(acceso)).thenReturn(new SeguimientoService.Vista(42,"en_camino","Técnico",
            null,null,false,null,null,false,false));
        socket.handleTextMessage(sesion,new TextMessage("{\"ticket\":\"permiso\"}"));
        socket.publicar();
        verify(servicio).consultar(acceso);
        verify(sesion).sendMessage(argThat(m->m instanceof TextMessage t && t.getPayload().contains("\"orden\":42")));
        // Una contraseña cambiada, cuenta inactiva o una orden ajena cierran el canal.
        when(servicio.consultar(acceso)).thenThrow(new IllegalStateException());
        socket.publicar();
        verify(sesion).close(CloseStatus.POLICY_VIOLATION);
    }
    @Test void al_terminar_el_trayecto_envia_estado_y_cierra() throws Exception {
        var acceso=new SeguimientoService.Acceso(2,42,0,java.time.Instant.now().plusSeconds(60));
        when(servicio.consumir("permiso")).thenReturn(acceso);
        when(servicio.consultar(acceso)).thenReturn(new SeguimientoService.Vista(42,"en_diagnostico","Técnico",
            null,null,false,null,null,false,false));
        socket.handleTextMessage(sesion,new TextMessage("{\"ticket\":\"permiso\"}"));
        socket.publicar();
        verify(sesion).sendMessage(any(TextMessage.class));
        verify(sesion).close(CloseStatus.POLICY_VIOLATION);
    }
    @Test void un_canal_autenticado_no_admite_cambiar_de_orden() throws Exception {
        var acceso=new SeguimientoService.Acceso(2,42,0,java.time.Instant.now().plusSeconds(60));
        when(servicio.consumir("uno")).thenReturn(acceso);
        socket.handleTextMessage(sesion,new TextMessage("{\"ticket\":\"uno\"}"));
        socket.handleTextMessage(sesion,new TextMessage("{\"ticket\":\"otro\"}"));
        verify(servicio,never()).consumir("otro");
    }
    @Test void tickets_no_se_imprimen_en_registros() {
        assertThat(new SeguimientoService.Ticket("secreto").toString()).doesNotContain("secreto");
    }
}

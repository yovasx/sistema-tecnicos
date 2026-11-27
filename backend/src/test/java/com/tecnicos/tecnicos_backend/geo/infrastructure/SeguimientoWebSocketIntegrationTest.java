package com.tecnicos.tecnicos_backend.geo.infrastructure;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.util.Map;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;

/** Roundtrip real; opcionalmente verifica también el proxy Nginx local. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class SeguimientoWebSocketIntegrationTest {
    @LocalServerPort int puerto;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    long orden;
    WebSocket socket, repetido;
    final HttpClient http=HttpClient.newHttpClient();
    static class Receptor implements WebSocket.Listener {
        final CompletableFuture<String> mensaje=new CompletableFuture<>();
        final CompletableFuture<Integer> cierre=new CompletableFuture<>();
        final StringBuilder partes=new StringBuilder();
        @Override public void onOpen(WebSocket s) { s.request(1); }
        @Override public CompletionStage<?> onText(WebSocket s,CharSequence texto,boolean ultimo) {
            partes.append(texto);
            if(ultimo) { mensaje.complete(partes.toString()); partes.setLength(0); }
            s.request(1); return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket s,int codigo,String motivo) {
            cierre.complete(codigo); return null;
        }
        @Override public void onError(WebSocket s,Throwable error) {
            mensaje.completeExceptionally(error); cierre.completeExceptionally(error);
        }
    }
    @AfterEach void limpiarSoloFixtureCreada() {
        if(socket!=null) socket.abort();
        if(repetido!=null) repetido.abort();
        if(orden!=0) {
            jdbc.update("DELETE FROM identity.tickets_seguimiento WHERE orden_id=?",orden);
            jdbc.update("DELETE FROM orders.busquedas_servicio WHERE orden_id=?",orden);
            jdbc.update("DELETE FROM orders.atenciones WHERE orden_id=?",orden);
            // Solo nuestra orden nueva. Su historial usa ON DELETE CASCADE.
            jdbc.update("DELETE FROM orders.ordenes_servicio WHERE id=?",orden);
        }
    }
    @Test void handshake_snapshot_y_rechazo_de_ticket_reutilizado() throws Exception {
        orden=jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,tecnico_id,categoria_id,
              descripcion_falla,ubicacion_cliente,direccion_referencia,estado)
            VALUES((SELECT id FROM identity.usuarios WHERE email='maria.quispe@ejemplo.bo'),
              (SELECT id FROM identity.usuarios WHERE email='diego.vargas@ejemplo.bo'),
              (SELECT min(id) FROM orders.categorias_servicio WHERE activa),
              'Fixture WebSocket de integración',ST_SetSRID(ST_MakePoint(-68.13,-16.5),4326)::geography,
              'Referencia de prueba WebSocket','en_camino') RETURNING id
            """,Long.class);
        String externo=System.getenv("SEGUIMIENTO_PRUEBA_URL");
        String base=externo==null?"http://localhost:"+puerto:externo;
        var login=http.send(HttpRequest.newBuilder(URI.create(base+"/api/auth/login"))
            .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(
                "{\"email\":\"maria.quispe@ejemplo.bo\",\"password\":\"Fixly2026!\"}")).build(),
            HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).isEqualTo(200);
        String token=json.readTree(login.body()).path("token").asString();
        var permiso=http.send(HttpRequest.newBuilder(URI.create(base+"/api/ordenes/"+orden+"/seguimiento/ticket"))
            .header("Authorization","Bearer "+token).POST(HttpRequest.BodyPublishers.noBody()).build(),
            HttpResponse.BodyHandlers.ofString());
        assertThat(permiso.statusCode()).isEqualTo(200);
        String ticket=json.readTree(permiso.body()).path("ticket").asString();
        URI canal=URI.create(base.replaceFirst("^http","ws")+"/api/ws/seguimiento");
        var receptor=new Receptor();
        socket=http.newWebSocketBuilder().buildAsync(canal,receptor).get(10,TimeUnit.SECONDS);
        socket.sendText(json.writeValueAsString(Map.of("ticket",ticket)),true).join();
        var snapshot=json.readTree(receptor.mensaje.get(10,TimeUnit.SECONDS));
        assertThat(snapshot.path("orden").longValue()).isEqualTo(orden);
        assertThat(snapshot.path("estado").asString()).isEqualTo("en_camino");
        assertThat(snapshot.path("posicion").isNull()).isTrue();
        assertThat(snapshot.has("ticket")).isFalse();
        // La segunda conexión se cierra sin recibir ubicación ni snapshot.
        var segundo=new Receptor();
        repetido=http.newWebSocketBuilder().buildAsync(canal,segundo).get(10,TimeUnit.SECONDS);
        repetido.sendText(json.writeValueAsString(Map.of("ticket",ticket)),true).join();
        assertThat(segundo.cierre.get(10,TimeUnit.SECONDS)).isEqualTo(1008);
        assertThat(segundo.mensaje.isDone()).isFalse();
    }
}

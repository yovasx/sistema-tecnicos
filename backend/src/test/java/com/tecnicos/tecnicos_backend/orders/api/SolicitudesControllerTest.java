package com.tecnicos.tecnicos_backend.orders.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SolicitudesControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    private String cliente,clave;
    private long clienteId;
    private int categoria;
    private static Path archivos;
    @DynamicPropertySource static void almacenamiento(DynamicPropertyRegistry r) throws Exception {
        archivos=Files.createTempDirectory("fixly-solicitudes-test-");
        r.add("app.uploads.dir",()->archivos.toString());
    }
    @BeforeEach void preparar() throws Exception {
        cliente=login("maria.quispe@ejemplo.bo"); clave=UUID.randomUUID().toString();
        clienteId=jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email='maria.quispe@ejemplo.bo'",Long.class);
        categoria=jdbc.queryForObject("SELECT id FROM orders.categorias_servicio WHERE nombre='Plomería'",Integer.class);
    }
    @Test void crea_solicitado_con_actor_cliente_y_sin_asignacion_importes_ni_ofertas() throws Exception {
        var r=mvc.perform(solicitud(clave,cliente).param("cliente_id","1")).andExpect(status().isCreated())
            .andExpect(jsonPath("$.estado").value("solicitado")).andExpect(jsonPath("$.creada").value(true)).andReturn();
        long id=id(r);
        assertThat(jdbc.queryForObject("SELECT cliente_id FROM orders.ordenes_servicio WHERE id=?",Long.class,id)).isEqualTo(clienteId);
        assertThat(jdbc.queryForObject("SELECT tecnico_id FROM orders.ordenes_servicio WHERE id=?",Long.class,id)).isNull();
        assertThat(jdbc.queryForObject("SELECT usuario_id FROM orders.transiciones_estado WHERE orden_id=?",Long.class,id)).isEqualTo(clienteId);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM orders.ofertas_orden WHERE orden_id=?",Integer.class,id)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM billing.cotizaciones WHERE orden_id=?",Integer.class,id)).isZero();
        mvc.perform(get("/api/ordenes/"+id).header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.latitud").value(-16.51)).andExpect(jsonPath("$.longitud").value(-68.13))
            .andExpect(jsonPath("$.evidenciaDisponible").value(false)).andExpect(jsonPath("$.tecnico").doesNotExist())
            .andExpect(jsonPath("$.finalizadoEn").doesNotExist());
    }
    @Test void reintentar_es_idempotente_y_devuelve_estado_actual_aunque_categoria_se_desactive() throws Exception {
        long id=id(mvc.perform(solicitud(clave,cliente)).andExpect(status().isCreated()).andReturn());
        jdbc.update("UPDATE orders.categorias_servicio SET activa=false WHERE id=?",categoria);
        jdbc.update("UPDATE orders.ordenes_servicio SET estado='cancelado',motivo_cancelacion='Prueba' WHERE id=?",id);
        mvc.perform(solicitud(clave,cliente)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
            .andExpect(jsonPath("$.creada").value(false)).andExpect(jsonPath("$.estado").value("cancelado"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM orders.solicitudes_cliente WHERE cliente_id=? AND clave=?::uuid",
            Integer.class,clienteId,clave)).isEqualTo(1);
    }
    @Test void cambiar_payload_con_misma_clave_responde_409() throws Exception {
        mvc.perform(solicitud(clave,cliente)).andExpect(status().isCreated());
        var cambiado=solicitud(clave,cliente);
        cambiado.with(r->{r.setParameter("descripcion","Otra falla suficientemente detallada"); return r;});
        mvc.perform(cambiado).andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("CLAVE_SOLICITUD_REUTILIZADA"));
    }
    @Test void empresa_tambien_crea_y_no_ve_solicitudes_de_persona() throws Exception {
        long personal=id(mvc.perform(solicitud(clave,cliente)).andReturn());
        String empresa=login("contacto@ferreteria-lapaz.bo");
        long empresarial=id(mvc.perform(solicitud(clave,empresa)).andExpect(status().isCreated()).andReturn());
        assertThat(empresarial).isNotEqualTo(personal);
        mvc.perform(get("/api/ordenes/"+personal).header("Authorization","Bearer "+empresa)).andExpect(status().isNotFound());
        mvc.perform(get("/api/ordenes").header("Authorization","Bearer "+empresa))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.elementos[0].id").value(empresarial));
    }
    @Test void lista_paginada_sin_direccion_contactos_coordenadas_ni_urls() throws Exception {
        long a=id(mvc.perform(solicitud(clave,cliente)).andReturn());
        long b=id(mvc.perform(solicitud(UUID.randomUUID().toString(),cliente)).andReturn());
        var r=mvc.perform(get("/api/ordenes").param("tamano","1").header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2))
            .andExpect(jsonPath("$.elementos[0].id").value(b)).andReturn();
        assertThat(texto(r)).doesNotContain("referencia","latitud","longitud","foto","email","telefono");
        mvc.perform(get("/api/ordenes").param("tamano","1").param("pagina","1").header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(jsonPath("$.elementos[0].id").value(a));
    }
    @Test void facturacion_suma_la_ultima_cotizacion_aceptada_en_bob_y_filtra_por_dia_boliviano_y_sucursal() throws Exception {
        long sinEquipo=id(mvc.perform(solicitud(clave,cliente)).andExpect(status().isCreated()).andReturn());
        long conEquipo=id(mvc.perform(solicitud(UUID.randomUUID().toString(),cliente)).andExpect(status().isCreated()).andReturn());
        long sucursal=jdbc.queryForObject("INSERT INTO identity.sucursales_cliente(cliente_id,nombre,referencia) VALUES(?,?,?) RETURNING id",
            Long.class,clienteId,"Sucursal Centro","Avenida Arce 123");
        long equipo=jdbc.queryForObject("INSERT INTO orders.equipos_cliente(cliente_id,sucursal_id,nombre) VALUES(?,?,?) RETURNING id",
            Long.class,clienteId,sucursal,"Compresor");
        jdbc.update("INSERT INTO orders.equipos_orden(orden_id,equipo_id,nombre_snapshot,sucursal_snapshot,sucursal_id) VALUES(?,?,?,?,?)",
            conEquipo,equipo,"Compresor","Sucursal Centro",sucursal);
        cotizar(sinEquipo,"150.00","2026-01-15T23:30:00-04:00","BOB");
        cotizar(conEquipo,"200.00","2026-01-16T10:00:00-04:00","BOB");
        mvc.perform(get("/api/ordenes/facturacion").header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.totalAceptado").value(350.00)).andExpect(jsonPath("$.moneda").value("BOB"))
            .andExpect(jsonPath("$.lineas.length()").value(2))
            .andExpect(jsonPath("$.lineas[0].orden").value(conEquipo))
            .andExpect(jsonPath("$.lineas[0].sucursal").value("Sucursal Centro"));
        mvc.perform(get("/api/ordenes/facturacion").param("desde","2026-01-15").param("hasta","2026-01-15")
                .header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalAceptado").value(150.00))
            .andExpect(jsonPath("$.lineas.length()").value(1)).andExpect(jsonPath("$.lineas[0].orden").value(sinEquipo));
        mvc.perform(get("/api/ordenes/facturacion").param("sucursal",String.valueOf(sucursal))
                .header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalAceptado").value(200.00))
            .andExpect(jsonPath("$.lineas.length()").value(1)).andExpect(jsonPath("$.lineas[0].orden").value(conEquipo));
        mvc.perform(get("/api/ordenes/facturacion").param("desde","2026-01-16").param("hasta","2026-01-16")
                .param("sucursal",String.valueOf(sucursal)).header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalAceptado").value(200.00));
        mvc.perform(get("/api/ordenes/facturacion").param("desde","2026-01-20").param("hasta","2026-01-19")
                .header("Authorization","Bearer "+cliente))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("FILTROS_INVALIDOS"));
        mvc.perform(get("/api/ordenes/facturacion").header("Authorization","Bearer "+login("contacto@ferreteria-lapaz.bo")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalAceptado").value(0))
            .andExpect(jsonPath("$.lineas.length()").value(0));
    }
    @Test void evidencia_privada_dueno_admin_y_sin_cache_otros_no() throws Exception {
        long id=id(mvc.perform(solicitud(clave,cliente).file(pdf())).andExpect(status().isCreated()).andReturn());
        String url=jdbc.queryForObject("SELECT foto_evidencia_url FROM orders.ordenes_servicio WHERE id=?",String.class,id);
        assertThat(url).startsWith("/perfiles/").doesNotContain("original");
        mvc.perform(get("/api/ordenes/"+id).header("Authorization","Bearer "+cliente))
            .andExpect(status().isOk()).andExpect(jsonPath("$.evidenciaDisponible").value(true))
            .andExpect(jsonPath("$.fotoEvidenciaUrl").doesNotExist());
        for(String token:List.of(cliente,login("admin@fixly.bo"))) {
            mvc.perform(get("/api/ordenes/"+id+"/evidencia").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(header().string("X-Content-Type-Options","nosniff"))
                .andExpect(header().string("Content-Disposition",org.hamcrest.Matchers.containsString("attachment")));
        }
        mvc.perform(get("/api/ordenes/"+id+"/evidencia")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/ordenes/"+id+"/evidencia").header("Authorization","Bearer "+login("contacto@ferreteria-lapaz.bo")))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/ordenes/"+id+"/evidencia").header("Authorization","Bearer "+login("diego.vargas@ejemplo.bo")))
            .andExpect(status().isForbidden());
    }
    @Test void urls_heredadas_no_se_descargan_y_archivo_ausente_es_404() throws Exception {
        long id=id(mvc.perform(solicitud(clave,cliente)).andReturn());
        mvc.perform(get("/api/ordenes/"+id+"/evidencia").header("Authorization","Bearer "+cliente)).andExpect(status().isNotFound());
        jdbc.update("UPDATE orders.ordenes_servicio SET foto_evidencia_url='https://no-abrir.example/archivo.pdf' WHERE id=?",id);
        mvc.perform(get("/api/ordenes/"+id+"/evidencia").header("Authorization","Bearer "+cliente)).andExpect(status().isNotFound());
        jdbc.update("UPDATE orders.ordenes_servicio SET foto_evidencia_url=? WHERE id=?","/perfiles/"+UUID.randomUUID()+".pdf",id);
        mvc.perform(get("/api/ordenes/"+id+"/evidencia").header("Authorization","Bearer "+cliente)).andExpect(status().isNotFound());
    }
    @Test void categoria_inactiva_no_crea_orden() throws Exception {
        jdbc.update("UPDATE orders.categorias_servicio SET activa=false WHERE id=?",categoria);
        mvc.perform(solicitud(clave,cliente)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.codigo").value("CATEGORIA_NO_DISPONIBLE"));
    }
    @Test void campos_invalidos_faltantes_y_no_finitos_responden_400() throws Exception {
        for(String[] caso:new String[][]{{"latitud","NaN"},{"latitud","91"},{"longitud","-181"},{"longitud","Infinity"},
            {"descripcion","corta"},{"referencia","x"},{"clave","no-es-uuid"},{"categoria","0"}}) {
            var peticion=solicitud(clave,cliente);
            peticion.with(r->{r.setParameter(caso[0],caso[1]); return r;});
            mvc.perform(peticion).andExpect(status().isBadRequest());
        }
        mvc.perform(multipart("/api/ordenes").header("Authorization","Bearer "+cliente).param("clave",clave))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/ordenes").param("pagina","-1").header("Authorization","Bearer "+cliente)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/ordenes").param("tamano","101").header("Authorization","Bearer "+cliente)).andExpect(status().isBadRequest());
    }
    @Test void archivo_disfrazado_vacio_o_multiples_son_rechazados() throws Exception {
        for(MockMultipartFile file:List.of(new MockMultipartFile("evidencia","mal.png","image/png","texto".getBytes()),
            new MockMultipartFile("evidencia","vacio.pdf","application/pdf",new byte[0]),
            new MockMultipartFile("evidencia","mal.exe","application/pdf","%PDF-".getBytes()),
            new MockMultipartFile("evidencia","grande.pdf","application/pdf",new byte[8*1024*1024+1]))) {
            mvc.perform(solicitud(clave,cliente).file(file)).andExpect(status().isBadRequest());
        }
        mvc.perform(solicitud(clave,cliente).file(pdf()).file(pdf())).andExpect(status().isBadRequest());
    }
    @Test void solo_clientes_activos_crean_y_admin_no_accede_a_listado_personal() throws Exception {
        mvc.perform(solicitud(clave,null)).andExpect(status().isUnauthorized());
        for(String email:List.of("admin@fixly.bo","diego.vargas@ejemplo.bo")) {
            String token=login(email);
            mvc.perform(solicitud(clave,token)).andExpect(status().isForbidden());
            mvc.perform(get("/api/ordenes").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        }
        jdbc.update("UPDATE identity.usuarios SET activo=false WHERE id=?",clienteId);
        mvc.perform(solicitud(clave,cliente)).andExpect(status().isUnauthorized());
    }
    @Test void funcion_sql_exige_actor_cliente_no_confia_en_id_del_request() throws Exception {
        jdbc.queryForObject("SELECT set_config('app.usuario_id','',true)",String.class);
        assertThat(jdbc.queryForObject("SELECT orders.usuario_actual()",Long.class)).isNull();
        // El controlador publica al usuario autenticado dentro de su transacción.
        long id=id(mvc.perform(solicitud(clave,cliente)).andExpect(status().isCreated()).andReturn());
        assertThat(jdbc.queryForObject("SELECT usuario_id FROM orders.transiciones_estado WHERE orden_id=?",Long.class,id)).isEqualTo(clienteId);
    }
    @Test @Transactional(propagation=Propagation.NOT_SUPPORTED)
    void envios_concurrentes_crean_una_sola_orden_y_limpian_evidencia_duplicada() throws Exception {
        var barrera=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<MvcResult> llamada=()-> { barrera.await(); return mvc.perform(solicitud(clave,cliente).file(pdf())).andReturn(); };
            var a=executor.submit(llamada); var b=executor.submit(llamada); barrera.countDown();
            var ra=a.get(30,TimeUnit.SECONDS); var rb=b.get(30,TimeUnit.SECONDS);
            assertThat(List.of(ra.getResponse().getStatus(),rb.getResponse().getStatus())).containsExactlyInAnyOrder(200,201);
            assertThat(id(ra)).isEqualTo(id(rb));
            long orden=id(ra);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM orders.transiciones_estado WHERE orden_id=?",Integer.class,orden)).isEqualTo(1);
            String url=jdbc.queryForObject("SELECT foto_evidencia_url FROM orders.ordenes_servicio WHERE id=?",String.class,orden);
            assertThat(Files.exists(archivos.resolve(url.substring(1)))).isTrue();
        } finally {
            var ids=jdbc.queryForList("SELECT orden_id FROM orders.solicitudes_cliente WHERE cliente_id=? AND clave=?::uuid",Long.class,clienteId,clave);
            jdbc.update("DELETE FROM orders.solicitudes_cliente WHERE cliente_id=? AND clave=?::uuid",clienteId,clave);
            for(long id:ids) {
                String url=jdbc.queryForObject("SELECT foto_evidencia_url FROM orders.ordenes_servicio WHERE id=?",String.class,id);
                jdbc.update("DELETE FROM orders.busquedas_servicio WHERE orden_id=?",id);
                jdbc.update("DELETE FROM orders.atenciones WHERE orden_id=?",id);
                jdbc.update("DELETE FROM orders.ordenes_servicio WHERE id=?",id);
                if(url!=null) Files.deleteIfExists(archivos.resolve(url.substring(1)));
            }
        }
    }
    private MockMultipartHttpServletRequestBuilder solicitud(String key,String token) {
        var b=multipart("/api/ordenes");
        b.param("clave",key).param("categoria",String.valueOf(categoria))
            .param("descripcion","La cocina presenta una fuga de agua.").param("latitud","-16.51").param("longitud","-68.13")
            .param("referencia","Sopocachi, puerta azul.").param("urgencia","false");
        if(token!=null) b.header("Authorization","Bearer "+token);
        return b;
    }
    private MockMultipartFile pdf() { return new MockMultipartFile("evidencia","original.pdf","application/pdf","%PDF-1.4\n%%EOF".getBytes(StandardCharsets.US_ASCII)); }
    /** Deja una cotización aceptada real: borrador con ítem, envío y respuesta del cliente. */
    private void cotizar(long orden,String total,String respondidaEn,String moneda) {
        long id=jdbc.queryForObject("INSERT INTO billing.cotizaciones(orden_id,estado,moneda) VALUES(?,'borrador',?) RETURNING id",
            Long.class,orden,moneda);
        jdbc.update("INSERT INTO billing.cotizacion_items(cotizacion_id,tipo,descripcion,cantidad,precio_unitario) VALUES(?,'mano_obra','Trabajo autorizado',1,?)",
            id,new java.math.BigDecimal(total));
        jdbc.update("UPDATE billing.cotizaciones SET estado='enviada' WHERE id=?",id);
        jdbc.update("UPDATE billing.cotizaciones SET estado='aceptada',respondida_en=?::timestamptz WHERE id=?",respondidaEn,id);
    }
    private long id(MvcResult r) throws Exception { return ((Number)JsonPath.read(texto(r),"$.id")).longValue(); }
    private String login(String email) throws Exception {
        return JsonPath.read(texto(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn()),"$.token");
    }
    private String texto(MvcResult r) throws Exception { return r.getResponse().getContentAsString(StandardCharsets.UTF_8); }
}

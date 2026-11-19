package com.tecnicos.tecnicos_backend.admin.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OrdenesAdminControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    private long cliente,tecnico;
    private int categoria;
    private String nombre,token;

    @BeforeEach void preparar() throws Exception {
        nombre="OrdenPrueba"+UUID.randomUUID();
        cliente=jdbc.queryForObject("""
            INSERT INTO identity.usuarios(rol,nombre,apellido,email,telefono,activo)
            VALUES ('cliente',?,'Consulta',?,'+591 70012345',true) RETURNING id
            """,Long.class,nombre,nombre+"@prueba.bo");
        tecnico=id("diego.vargas@ejemplo.bo");
        categoria=jdbc.queryForObject("SELECT id FROM orders.categorias_servicio WHERE nombre='Plomería'",Integer.class);
        token=login("admin@fixly.bo");
    }

    @Test void listado_real_sin_contactos_ubicacion_ni_evidencia() throws Exception {
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        var r=lista("busqueda",String.valueOf(orden)).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.elementos[0].cliente.nombre").value(nombre+" Consulta"))
            .andExpect(jsonPath("$.elementos[0].tecnico").isEmpty())
            .andExpect(jsonPath("$.elementos[0].categoria.nombre").value("Plomería")).andReturn();
        assertThat(texto(r)).doesNotContain("ubicacion","direccionReferencia","latitud","email","telefono",
            "fotoEvidenciaUrl","password","ciFrente","descripcionFalla","BASE_PRIVADA");
    }

    @Test void filtros_combinados_y_paginacion_sin_duplicados() throws Exception {
        long primera=orden("solicitado",null,"2026-11-18T12:00:00Z");
        long segunda=orden("solicitado",null,"2026-11-18T12:00:00Z");
        orden("finalizado",tecnico,"2026-11-18T13:00:00Z");
        mvc.perform(get("/api/admin/ordenes").header("Authorization","Bearer "+token)
            .param("busqueda",nombre).param("estado","solicitado").param("categoria",String.valueOf(categoria))
            .param("asignacion","sin_asignar").param("desde","2026-11-18").param("hasta","2026-11-18")
            .param("tamano","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2))
            .andExpect(jsonPath("$.elementos.length()").value(1)).andExpect(jsonPath("$.elementos[0].id").value(segunda));
        mvc.perform(get("/api/admin/ordenes").header("Authorization","Bearer "+token)
            .param("busqueda",nombre).param("estado","solicitado").param("tamano","1").param("pagina","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.elementos[0].id").value(primera));
        lista("asignacion","asignada","busqueda",nombre).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        lista("busqueda",nombre,"pagina","10").andExpect(status().isOk()).andExpect(jsonPath("$.elementos").isEmpty());
    }

    @Test void rango_incluye_dia_boliviano_y_excluye_limites_de_otros_dias() throws Exception {
        orden("solicitado",null,"2026-11-18T03:59:59Z");
        long inicio=orden("solicitado",null,"2026-11-18T04:00:00Z");
        long fin=orden("solicitado",null,"2026-11-19T03:59:59.999999Z");
        orden("solicitado",null,"2026-11-19T04:00:00Z");
        lista("busqueda",nombre,"desde","2026-11-18","hasta","2026-11-18")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2))
            .andExpect(jsonPath("$.elementos[0].id").value(fin)).andExpect(jsonPath("$.elementos[1].id").value(inicio));
    }

    @Test void detalle_privado_con_coordenadas_correctas_y_fechas_faltantes() throws Exception {
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        mvc.perform(get("/api/admin/ordenes/"+orden).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.descripcionFalla").value("BASE_PRIVADA: fuga en cocina"))
            .andExpect(jsonPath("$.direccionReferencia").value("Referencia privada Sopocachi"))
            .andExpect(jsonPath("$.ubicacion.latitud").value(-16.51))
            .andExpect(jsonPath("$.ubicacion.longitud").value(-68.13))
            .andExpect(jsonPath("$.cliente.email").value(nombre+"@prueba.bo"))
            .andExpect(jsonPath("$.asignadoEn").isEmpty()).andExpect(jsonPath("$.finalizadoEn").isEmpty())
            .andExpect(jsonPath("$.cancelacion").isEmpty()).andExpect(jsonPath("$.fotoEvidenciaUrl").doesNotExist());
    }

    @Test void cancelacion_muestra_datos_registrados_y_actor_desconocido() throws Exception {
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        jdbc.update("UPDATE orders.ordenes_servicio SET estado='cancelado',motivo_cancelacion='Cliente no requiere el servicio' WHERE id=?",orden);
        mvc.perform(get("/api/admin/ordenes/"+orden).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("cancelado"))
            .andExpect(jsonPath("$.cancelacion.motivo").value("Cliente no requiere el servicio"))
            .andExpect(jsonPath("$.cancelacion.canceladoEn").isNotEmpty())
            .andExpect(jsonPath("$.cancelacion.autor").isEmpty());
    }

    @Test void participantes_inactivos_no_ocultan_ordenes() throws Exception {
        long orden=orden("finalizado",tecnico,"2026-11-18T12:00:00Z");
        jdbc.update("UPDATE identity.usuarios SET activo=false WHERE id IN (?,?)",cliente,tecnico);
        lista("busqueda",String.valueOf(orden)).andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.elementos[0].tecnico.activo").value(false));
        mvc.perform(get("/api/admin/ordenes/"+orden).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.cliente.persona.activo").value(false));
    }

    @Test void cuentas_eliminadas_conservan_orden_pero_no_exponen_identidad() throws Exception {
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        jdbc.update("UPDATE identity.usuarios SET activo=false,eliminado_en=now() WHERE id=?",cliente);
        var r=mvc.perform(get("/api/admin/ordenes/"+orden).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.cliente.persona.nombre").value("Cuenta eliminada"))
            .andExpect(jsonPath("$.cliente.persona.id").isEmpty()).andExpect(jsonPath("$.cliente.email").isEmpty())
            .andExpect(jsonPath("$.cliente.telefono").isEmpty()).andReturn();
        assertThat(texto(r)).doesNotContain(nombre,"+591 70012345");
        lista("busqueda",nombre).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        lista("busqueda",String.valueOf(orden)).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
    }

    @Test void historial_real_sin_reconstruccion_con_actor_y_observacion() throws Exception {
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        jdbc.queryForObject("SELECT set_config('app.usuario_id',?,true)",String.class,String.valueOf(cliente));
        jdbc.update("UPDATE orders.ordenes_servicio SET estado='cancelado',motivo_cancelacion='Cancelación de prueba' WHERE id=?",orden);
        mvc.perform(get("/api/admin/ordenes/"+orden+"/historial").header("Authorization","Bearer "+token).param("tamano","1"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.elementos[0].estadoAnterior").value("solicitado"))
            .andExpect(jsonPath("$.elementos[0].estadoNuevo").value("cancelado"))
            .andExpect(jsonPath("$.elementos[0].autor.id").value(cliente))
            .andExpect(jsonPath("$.elementos[0].observacion").value("Cancelación de prueba"));
        mvc.perform(get("/api/admin/ordenes/"+orden+"/historial").header("Authorization","Bearer "+token)
            .param("tamano","1").param("pagina","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.elementos[0].estadoAnterior").isEmpty())
            .andExpect(jsonPath("$.elementos[0].autor").isEmpty());
        jdbc.update("DELETE FROM orders.transiciones_estado WHERE orden_id=?",orden);
        mvc.perform(get("/api/admin/ordenes/"+orden+"/historial").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
    }

    @Test void busqueda_es_literal_y_el_id_es_exacto() throws Exception {
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        lista("busqueda","%_' OR TRUE --").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        lista("busqueda","99999999999999999999999999999999").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        lista("busqueda",String.valueOf(orden)).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
    }

    @Test void filtros_sin_resultados_y_nombre_del_tecnico() throws Exception {
        long orden=orden("finalizado",tecnico,"2026-11-18T12:00:00Z");
        lista("busqueda","Diego Vargas","estado","finalizado").andExpect(status().isOk())
            .andExpect(jsonPath("$.elementos[0].id").value(orden));
        lista("busqueda",nombre,"estado","en_diagnostico").andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.elementos").isEmpty());
    }

    @Test void historial_oculta_identidad_de_actor_eliminado_y_no_admite_escrituras() throws Exception {
        jdbc.queryForObject("SELECT set_config('app.usuario_id',?,true)",String.class,String.valueOf(cliente));
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        jdbc.update("UPDATE identity.usuarios SET activo=false,eliminado_en=now() WHERE id=?",cliente);
        var r=mvc.perform(get("/api/admin/ordenes/"+orden+"/historial").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.elementos[0].autor.nombre").value("Cuenta eliminada"))
            .andExpect(jsonPath("$.elementos[0].autor.id").isEmpty()).andReturn();
        assertThat(texto(r)).doesNotContain(nombre);
        mvc.perform(post("/api/admin/ordenes").header("Authorization","Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isMethodNotAllowed());
        mvc.perform(patch("/api/admin/ordenes/"+orden).header("Authorization","Bearer "+token)
            .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"cancelado\"}")).andExpect(status().isMethodNotAllowed());
    }

    @Test void inexistentes_y_parametros_invalidos_no_generan_500() throws Exception {
        for(String sufijo:new String[]{"","/historial"}) {
            mvc.perform(get("/api/admin/ordenes/9223372036854775807"+sufijo).header("Authorization","Bearer "+token))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.codigo").value("ORDEN_NO_ENCONTRADA"));
            mvc.perform(get("/api/admin/ordenes/0"+sufijo).header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        }
        for(String[] filtro:new String[][]{{"estado","disputa"},{"asignacion","inventada"},{"categoria","-1"},
            {"tamano","101"},{"tamano","0"},{"pagina","-1"},{"pagina","100001"},{"desde","2026-02-30"},
            {"desde","18/11/2026"},{"hasta","0000-01-01"},{"busqueda","a".repeat(151)}}) {
            lista(filtro).andExpect(status().isBadRequest());
        }
        lista("desde","2026-11-19","hasta","2026-11-18").andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/ordenes/1/historial").param("tamano","101").header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest());
    }

    @Test void solo_administrador_activo_y_sesion_vigente() throws Exception {
        for(String ruta:new String[]{"/api/admin/ordenes","/api/admin/ordenes/1","/api/admin/ordenes/1/historial"}) {
            mvc.perform(get(ruta)).andExpect(status().isUnauthorized());
            for(String email:new String[]{"maria.quispe@ejemplo.bo","diego.vargas@ejemplo.bo"})
                mvc.perform(get(ruta).header("Authorization","Bearer "+login(email))).andExpect(status().isForbidden());
        }
        jdbc.update("UPDATE identity.usuarios SET version_sesion=version_sesion+1 WHERE email='admin@fixly.bo'");
        lista().andExpect(status().isUnauthorized());
        token=login("admin@fixly.bo");
        jdbc.update("UPDATE identity.usuarios SET activo=false WHERE email='admin@fixly.bo'");
        lista().andExpect(status().isUnauthorized());
    }

    @Test void consultas_no_modifican_orden_ni_historial_o_disponibilidad() throws Exception {
        long orden=orden("solicitado",null,"2026-11-18T12:00:00Z");
        String antes=jdbc.queryForObject("SELECT row_to_json(o)::text FROM orders.ordenes_servicio o WHERE id=?",String.class,orden);
        int transiciones=jdbc.queryForObject("SELECT count(*) FROM orders.transiciones_estado WHERE orden_id=?",Integer.class,orden);
        String disponibilidad=jdbc.queryForObject("SELECT disponibilidad::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,tecnico);
        lista().andExpect(status().isOk());
        mvc.perform(get("/api/admin/ordenes/"+orden).header("Authorization","Bearer "+token)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/ordenes/"+orden+"/historial").header("Authorization","Bearer "+token)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT row_to_json(o)::text FROM orders.ordenes_servicio o WHERE id=?",String.class,orden)).isEqualTo(antes);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM orders.transiciones_estado WHERE orden_id=?",Integer.class,orden)).isEqualTo(transiciones);
        assertThat(jdbc.queryForObject("SELECT disponibilidad::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,tecnico)).isEqualTo(disponibilidad);
    }

    private long orden(String estado,Long tecnicoId,String creado) {
        return jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,tecnico_id,categoria_id,descripcion_falla,
                ubicacion_cliente,direccion_referencia,estado,creado_en,foto_evidencia_url)
            VALUES (?,?,?,'BASE_PRIVADA: fuga en cocina',ST_SetSRID(ST_MakePoint(-68.13,-16.51),4326)::geography,
                'Referencia privada Sopocachi',?::orders.estado_orden,?,'https://no-abrir.example/evidencia.jpg')
            RETURNING id
            """,Long.class,cliente,tecnicoId,categoria,estado,OffsetDateTime.parse(creado));
    }
    private ResultActions lista(String... pares) throws Exception {
        var peticion=get("/api/admin/ordenes").header("Authorization","Bearer "+token);
        for(int i=0;i<pares.length;i+=2) peticion.param(pares[i],pares[i+1]);
        return mvc.perform(peticion);
    }
    private long id(String email) { return jdbc.queryForObject("SELECT id FROM identity.usuarios WHERE email=?",Long.class,email); }
    private String login(String email) throws Exception {
        var r=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn();
        return JsonPath.read(texto(r),"$.token");
    }
    private String texto(MvcResult r) throws Exception { return r.getResponse().getContentAsString(StandardCharsets.UTF_8); }
}

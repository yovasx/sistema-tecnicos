package com.tecnicos.tecnicos_backend.admin.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Catálogo administrable: escritura atómica de categoría + tarifa + comisión,
 * versionado por vigencia y auditoría. Todo corre en una transacción de prueba
 * que se revierte al terminar.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CatalogoAdminControllerTest {

    private static final String EMAIL_ADMIN = "admin@fixly.bo";
    private static final String CLAVE = "Fixly2026!";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void crear_categoria_guarda_tarifa_comision_y_auditoria() throws Exception {
        String token = tokenAdmin();

        MvcResult resultado = mvc.perform(post("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Carpintería", "70.00", "12.50", true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nombre").value("Carpintería"))
                .andExpect(jsonPath("$.activa").value(true))
                .andExpect(jsonPath("$.tarifaVisita").value(70.00))
                .andExpect(jsonPath("$.tarifaHora").value(80.00))
                .andExpect(jsonPath("$.comisionPct").value(12.50))
                .andExpect(jsonPath("$.moneda").value("BOB"))
                .andExpect(jsonPath("$.tarifaVigenteDesde").value(hoy()))
                .andExpect(jsonPath("$.comisionVigenteDesde").value(hoy()))
                .andReturn();

        Integer id = JsonPath.read(cuerpo(resultado), "$.id");

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM billing.tarifas WHERE categoria_id = ?", Integer.class, id))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM billing.comisiones WHERE categoria_id = ?", Integer.class, id))
                .isEqualTo(1);

        Map<String, Object> auditoria = jdbc.queryForMap("""
                SELECT accion, admin_id, antes, despues
                FROM admin_svc.auditoria_catalogo
                WHERE categoria_id = ?
                ORDER BY id DESC LIMIT 1
                """, id);
        assertThat(auditoria.get("accion")).isEqualTo("crear");
        assertThat(auditoria.get("antes")).isNull();
        assertThat(String.valueOf(auditoria.get("despues"))).contains("Carpintería");
    }

    @Test
    void el_nombre_duplicado_sin_importar_mayusculas_responde_409() throws Exception {
        String token = tokenAdmin();

        mvc.perform(post("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("plomería", "50.00", "15.00", true)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CATEGORIA_DUPLICADA"));
    }

    @Test
    void editar_el_mismo_dia_actualiza_la_version_en_sitio() throws Exception {
        String token = tokenAdmin();
        Integer id = crear(token, "Jardinería", "40.00", "10.00");

        mvc.perform(put("/api/admin/categorias/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Jardinería", "55.00", "18.00", true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tarifaVisita").value(55.00))
                .andExpect(jsonPath("$.comisionPct").value(18.00));

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM billing.tarifas WHERE categoria_id = ?", Integer.class, id))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM billing.comisiones WHERE categoria_id = ?", Integer.class, id))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT tarifa_visita FROM billing.tarifas WHERE categoria_id = ? AND vigente_hasta IS NULL",
                BigDecimal.class, id)).isEqualByComparingTo("55.00");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM admin_svc.auditoria_catalogo
                WHERE categoria_id = ? AND accion = 'editar' AND antes IS NOT NULL AND despues IS NOT NULL
                """, Integer.class, id)).isEqualTo(1);
    }

    @Test
    void editar_en_otro_dia_cierra_la_vigencia_y_abre_una_version_nueva() throws Exception {
        String token = tokenAdmin();
        Integer id = crear(token, "Herrería", "60.00", "14.00");

        // Simula una tarifa y comisión cargadas hace cinco días.
        jdbc.update("UPDATE billing.tarifas SET vigente_desde = CURRENT_DATE - 5 WHERE categoria_id = ?", id);
        jdbc.update("UPDATE billing.comisiones SET vigente_desde = CURRENT_DATE - 5 WHERE categoria_id = ?", id);

        mvc.perform(put("/api/admin/categorias/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Herrería", "75.00", "16.00", true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tarifaVisita").value(75.00))
                .andExpect(jsonPath("$.tarifaVigenteDesde").value(hoy()));

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM billing.tarifas WHERE categoria_id = ?", Integer.class, id))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject("""
                SELECT vigente_hasta FROM billing.tarifas
                WHERE categoria_id = ? AND vigente_hasta IS NOT NULL
                """, LocalDate.class, id)).isEqualTo(LocalDate.parse(hoy()).minusDays(1));
        assertThat(jdbc.queryForObject("""
                SELECT tarifa_visita FROM billing.tarifas
                WHERE categoria_id = ? AND vigente_hasta IS NULL
                """, BigDecimal.class, id)).isEqualByComparingTo("75.00");

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM billing.comisiones WHERE categoria_id = ?", Integer.class, id))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject("""
                SELECT porcentaje FROM billing.comisiones
                WHERE categoria_id = ? AND vigente_hasta IS NULL
                """, BigDecimal.class, id)).isEqualByComparingTo("16.00");
    }

    @Test
    void desactivar_oculta_del_catalogo_publico_sin_borrar_nada() throws Exception {
        String token = tokenAdmin();
        Integer id = crear(token, "Cerrajería", "45.00", "15.00");

        mvc.perform(put("/api/admin/categorias/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Cerrajería", "45.00", "15.00", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activa").value(false));

        String publico = cuerpo(mvc.perform(get("/api/publico/categorias"))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(publico).doesNotContain("Cerrajería");

        String admin = cuerpo(mvc.perform(get("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(admin).contains("Cerrajería").contains("\"activa\":false");

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM orders.categorias_servicio WHERE id = ?", Integer.class, id))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM billing.tarifas WHERE categoria_id = ?", Integer.class, id))
                .isEqualTo(1);
    }

    @Test
    void un_tecnico_no_puede_modificar_el_catalogo() throws Exception {
        String token = JsonPath.read(cuerpo(login("diego.vargas@ejemplo.bo")), "$.token");

        mvc.perform(post("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Intrusión", "10.00", "10.00", true)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("PERMISO_INSUFICIENTE"));
    }

    @Test
    void validaciones_rechazan_montos_y_porcentajes_fuera_de_rango() throws Exception {
        String token = tokenAdmin();

        mvc.perform(post("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Negativa", "-1.00", "15.00", true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));

        mvc.perform(post("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Comisión alta", "20.00", "150.00", true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));

        mvc.perform(post("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("A", "20.00", "10.00", true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    @Test
    void cambiar_solo_el_estado_no_renueva_precios_ni_comisiones() throws Exception {
        String token = tokenAdmin();
        Integer id = crear(token, "Pintura", "65.00", "14.00");
        jdbc.update("UPDATE billing.tarifas SET vigente_desde=CURRENT_DATE-5 WHERE categoria_id=?", id);
        jdbc.update("UPDATE billing.comisiones SET vigente_desde=CURRENT_DATE-5 WHERE categoria_id=?", id);
        mvc.perform(put("/api/admin/categorias/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Pintura", "65.00", "14.00", false)))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM billing.tarifas WHERE categoria_id=?",
                Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM billing.comisiones WHERE categoria_id=?",
                Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT vigente_desde FROM billing.tarifas WHERE categoria_id=?",
                LocalDate.class, id)).isEqualTo(LocalDate.parse(hoy()).minusDays(5));
    }

    @Test
    void reactivar_publica_el_precio_actual_sin_exponer_la_comision() throws Exception {
        String token = tokenAdmin();
        Integer id = crear(token, "Albañilería", "65.00", "13.00");
        mvc.perform(put("/api/admin/categorias/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Albañilería", "65.00", "13.00", false)))
                .andExpect(status().isOk());
        mvc.perform(put("/api/admin/categorias/" + id)
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Albañilería", "95.00", "13.00", true)))
                .andExpect(status().isOk());
        String publico = cuerpo(mvc.perform(get("/api/publico/categorias")).andReturn());
        assertThat(publico).contains("Albañilería").doesNotContain("comision");
        List<Map<String, Object>> filas = JsonPath.read(publico, "$");
        assertThat(filas.stream().filter(c -> "Albañilería".equals(c.get("nombre"))).findFirst()
                .orElseThrow().get("tarifaVisita")).isEqualTo(95.0);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM admin_svc.auditoria_catalogo a
                JOIN identity.usuarios u ON u.id=a.admin_id
                WHERE a.categoria_id=? AND u.email='admin@fixly.bo'
                """, Integer.class, id)).isEqualTo(3);
    }

    @Test
    void escritura_sin_token_no_esta_permitida() throws Exception {
        mvc.perform(post("/api/admin/categorias").contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("No autorizada", "10.00", "10.00", true)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void editar_una_categoria_inexistente_responde_422() throws Exception {
        String token = tokenAdmin();

        mvc.perform(put("/api/admin/categorias/999999")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria("Fantasma", "20.00", "10.00", true)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.codigo").value("REGLA_NEGOCIO"))
                .andExpect(jsonPath("$.mensaje").value("La categoría indicada no existe."));
    }

    private Integer crear(String token, String nombre, String visita, String comision) throws Exception {
        MvcResult resultado = mvc.perform(post("/api/admin/categorias")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cuerpoCategoria(nombre, visita, comision, true)))
                .andExpect(status().isCreated())
                .andReturn();
        return JsonPath.read(cuerpo(resultado), "$.id");
    }

    private String cuerpoCategoria(String nombre, String visita, String comision, boolean activa) {
        return """
                {"nombre":"%s","descripcion":"Servicio de prueba","activa":%s,
                 "tarifaVisita":%s,"tarifaHora":80.00,"recargoUrgenciaPct":20.00,
                 "moneda":"BOB","comisionPct":%s}
                """.formatted(nombre, activa, visita, comision);
    }

    private String hoy() {
        return jdbc.queryForObject("SELECT CURRENT_DATE::text", String.class);
    }

    private String tokenAdmin() throws Exception {
        return JsonPath.read(cuerpo(login(EMAIL_ADMIN)), "$.token");
    }

    private MvcResult login(String email) throws Exception {
        return mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + CLAVE + "\"}"))
                .andReturn();
    }

    private String cuerpo(MvcResult resultado) throws Exception {
        return resultado.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }
}

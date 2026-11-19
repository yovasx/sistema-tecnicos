package com.tecnicos.tecnicos_backend.admin.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DashboardAdminControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    private String token;
    @BeforeEach void preparar() throws Exception { token = login("admin@fixly.bo"); }

    @Test void snapshot_acotado_sin_datos_personales_y_con_dias_vacios() throws Exception {
        var r = mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.solicitudesPorDia.length()").value(7))
            .andExpect(jsonPath("$.generadoEn").isNotEmpty()).andReturn();
        String cuerpo = r.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(cuerpo).doesNotContain("email", "telefono", "latitud", "longitud", "direccion", "password", "ciFrente", "totalIngresos");
        List<Map<String, Object>> serie = JsonPath.read(cuerpo, "$.solicitudesPorDia");
        LocalDate anterior = null;
        for (var dia : serie) {
            LocalDate fecha = LocalDate.parse(dia.get("fecha").toString());
            if (anterior != null) assertThat(fecha).isEqualTo(anterior.plusDays(1));
            assertThat(((Number) dia.get("solicitudes")).longValue()).isNotNegative();
            anterior = fecha;
        }
        mvc.perform(get("/api/admin/dashboard").param("dias", "30").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.solicitudesPorDia.length()").value(30));
    }

    @Test void serie_usa_limites_bolivianos_inclusivos_y_fin_exclusivo() throws Exception {
        ZoneId bolivia = ZoneId.of("America/La_Paz");
        LocalDate hoy = jdbc.queryForObject("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date", LocalDate.class);
        OffsetDateTime inicio = hoy.minusDays(6).atStartOfDay(bolivia).toOffsetDateTime();
        long previa = cantidadDia(inicio);
        orden(inicio.minusNanos(1000), false);
        orden(inicio, false);
        orden(inicio.plusHours(23).plusMinutes(59), false);
        orden(hoy.plusDays(1).atStartOfDay(bolivia).toOffsetDateTime(), false);
        var r = mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.solicitudesPorDia[0].fecha").value(hoy.minusDays(6).toString()))
            .andExpect(jsonPath("$.solicitudesPorDia[0].solicitudes").value(previa + 2)).andReturn();
        List<Map<String, Object>> serie = JsonPath.read(r.getResponse().getContentAsString(), "$.solicitudesPorDia");
        assertThat(serie.getLast().get("fecha")).isEqualTo(hoy.toString());
    }

    @Test void cola_solo_solicitadas_sin_tecnico_y_prioriza_urgentes_con_limite() throws Exception {
        OffsetDateTime ahora = OffsetDateTime.now();
        for (int i = 0; i < 7; i++) orden(ahora.minusHours(10 + i), false);
        long urgente = orden(ahora, true);
        var r = mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.solicitudesPendientes.length()").value(5))
            .andExpect(jsonPath("$.solicitudesPendientes[0].id").value(urgente))
            .andExpect(jsonPath("$.metricas.solicitudesSinAsignar").value(jdbc.queryForObject(
                "SELECT count(*) FROM orders.ordenes_servicio WHERE estado='solicitado' AND tecnico_id IS NULL", Long.class)))
            .andReturn();
        assertThat(r.getResponse().getContentAsString()).doesNotContain("REFERENCIA_PRIVADA");
    }

    @Test void aprobados_excluyen_cuentas_inactivas_y_eliminadas() throws Exception {
        jdbc.update("UPDATE identity.usuarios SET activo=false WHERE email='diego.vargas@ejemplo.bo'");
        long esperado = jdbc.queryForObject("""
            SELECT count(*) FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
            WHERE u.rol='tecnico' AND u.activo AND u.eliminado_en IS NULL AND p.estado_validacion='aprobado'
            """, Long.class);
        mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.metricas.tecnicosActivosAprobados").value(esperado));
    }

    @Test void borrador_no_es_expediente_enviado_y_cuenta_inactiva_no_entra_a_cola() throws Exception {
        String email = "dashboard-" + UUID.randomUUID() + "@prueba.bo";
        var alta = mvc.perform(post("/api/tecnicos/registro").contentType("application/json")
            .content("{\"nombre\":\"Rosa\",\"apellido\":\"Panel\",\"email\":\"" + email + "\",\"password\":\"ClaveSegura2026!\"}"))
            .andExpect(status().isCreated()).andReturn();
        long id = ((Number) JsonPath.read(alta.getResponse().getContentAsString(), "$.usuario.id")).longValue();
        var antes = jdbc.queryForObject("""
            SELECT count(*) FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
            WHERE p.estado_expediente='en_revision' AND u.activo AND u.eliminado_en IS NULL
            """, Long.class);
        mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.metricas.expedientesEnRevision").value(antes));
        jdbc.update("UPDATE identity.perfiles_tecnico SET estado_expediente='en_revision',enviado_en=now() WHERE usuario_id=?", id);
        mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.metricas.expedientesEnRevision").value(antes + 1));
        jdbc.update("UPDATE identity.usuarios SET activo=false WHERE id=?", id);
        mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.metricas.expedientesEnRevision").value(antes));
    }

    @Test void solo_admin_activo_y_periodos_validos() throws Exception {
        mvc.perform(get("/api/admin/dashboard")).andExpect(status().isUnauthorized());
        for (String email : new String[]{"maria.quispe@ejemplo.bo", "diego.vargas@ejemplo.bo"}) {
            mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + login(email))).andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/admin/dashboard").param("dias", "365").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        jdbc.update("UPDATE identity.usuarios SET activo=false WHERE email='admin@fixly.bo'");
        mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
    private long cantidadDia(OffsetDateTime inicio) {
        return jdbc.queryForObject("SELECT count(*) FROM orders.ordenes_servicio WHERE creado_en>=? AND creado_en<?",
            Long.class, inicio, inicio.plusDays(1));
    }
    private long orden(OffsetDateTime creado, boolean urgencia) {
        return jdbc.queryForObject("""
            INSERT INTO orders.ordenes_servicio(cliente_id,categoria_id,descripcion_falla,ubicacion_cliente,
              direccion_referencia,tarifa_urgencia,creado_en)
            VALUES ((SELECT id FROM identity.usuarios WHERE email='maria.quispe@ejemplo.bo'),
              (SELECT id FROM orders.categorias_servicio WHERE nombre='Plomería'),
              'Falla para prueba del panel',ST_SetSRID(ST_MakePoint(-68.13,-16.51),4326)::geography,
              'REFERENCIA_PRIVADA',?,?) RETURNING id
            """, Long.class, urgencia, creado);
    }
    private String login(String email) throws Exception {
        var r = mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\"" + email + "\",\"password\":\"Fixly2026!\"}")).andExpect(status().isOk()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.token");
    }
}

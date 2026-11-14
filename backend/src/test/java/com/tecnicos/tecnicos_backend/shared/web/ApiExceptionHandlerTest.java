package com.tecnicos.tecnicos_backend.shared.web;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.UncategorizedSQLException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contrato de errores (SCRUM-45): un solo formato y mensajes en español que no
 * filtran nombres de tablas de Postgres.
 */
class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void violacion_de_unicidad_es_409_sin_filtrar_lo_que_dice_postgres() {
        SQLException cruda = new SQLException(
                "duplicate key value violates unique constraint \"uq_usuarios_email\"", "23505");

        ResponseEntity<ApiError> respuesta =
                handler.accesoDatos(new DataIntegrityViolationException("fallo", cruda));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(respuesta.getBody().codigo()).isEqualTo("REGISTRO_DUPLICADO");
        assertThat(respuesta.getBody().mensaje())
                .doesNotContain("uq_usuarios_email")
                .doesNotContain("duplicate key");
        assertThat(respuesta.getBody().campos()).isEmpty();
    }

    @Test
    void check_de_la_base_es_422() {
        SQLException cruda = new SQLException(
                "new row for relation \"ordenes_servicio\" violates check constraint", "23514");

        ResponseEntity<ApiError> respuesta =
                handler.accesoDatos(new DataIntegrityViolationException("fallo", cruda));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(respuesta.getBody().codigo()).isEqualTo("REGLA_NEGOCIO");
    }

    @Test
    void el_mensaje_de_nuestra_funcion_si_se_muestra_porque_ya_esta_en_espanol() {
        SQLException cruda = new SQLException(
                "Transición no permitida: solicitado -> finalizado", "P0001");

        ResponseEntity<ApiError> respuesta = handler.accesoDatos(
                new UncategorizedSQLException("query", "select 1", cruda));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
        assertThat(respuesta.getBody().codigo()).isEqualTo("REGLA_NEGOCIO");
        assertThat(respuesta.getBody().mensaje())
                .isEqualTo("Transición no permitida: solicitado -> finalizado");
    }

    @Test
    void sqlstate_desconocido_no_expone_el_error_crudo() {
        SQLException cruda = new SQLException("relation \"orders.ordenes_servicio\" does not exist", "42P01");

        ResponseEntity<ApiError> respuesta =
                handler.accesoDatos(new DataIntegrityViolationException("fallo", cruda));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(respuesta.getBody().mensaje())
                .doesNotContain("ordenes_servicio")
                .contains("Ocurrió un error inesperado");
    }

    @Test
    void sin_sqlstate_se_responde_500_en_espanol() {
        ResponseEntity<ApiError> respuesta =
                handler.accesoDatos(new DataIntegrityViolationException("algo raro"));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(respuesta.getBody().codigo()).isEqualTo("ERROR_INTERNO");
    }
}

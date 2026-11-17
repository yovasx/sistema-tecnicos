package com.tecnicos.tecnicos_backend.shared.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.sql.SQLException;
import java.util.List;

/**
 * Traduce las excepciones de Spring y de Postgres al formato {@link ApiError}.
 *
 * <p><b>Regla</b>: nunca se devuelve el mensaje crudo de Postgres, porque
 * filtra nombres de tablas e índices. Solo los mensajes que lanzan nuestras
 * propias funciones PL/pgSQL con {@code RAISE ... USING MESSAGE} son aptos para
 * el usuario, porque ya están redactados en español.</p>
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /**
     * Cuerpo ausente o JSON mal formado. Sin este handler el catch-all lo
     * convierte en 500, cuando en realidad es un error del cliente.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> cuerpoIlegible(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.de("DATOS_INVALIDOS", "El cuerpo de la petición no es válido."));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> tipoContenidoNoSoportado(
            HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiError.de("TIPO_CONTENIDO_NO_SOPORTADO",
                        "Enviá el contenido como application/json."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> metodoNoPermitido(
            HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiError.de("METODO_NO_PERMITIDO",
                        "Ese método no está permitido en esta ruta."));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> errorDeNegocio(ApiException ex) {
        return ResponseEntity.status(ex.estado())
                .body(ApiError.de(ex.codigo(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validacion(MethodArgumentNotValidException ex) {
        List<ApiError.CampoError> campos = ex.getBindingResult().getFieldErrors().stream()
                .map(this::aCampoError)
                .toList();
        return ResponseEntity.badRequest()
                .body(ApiError.de("DATOS_INVALIDOS", "Revisá los datos ingresados.", campos));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiError> accesoDatos(DataAccessException ex) {
        String sqlState = sqlState(ex);
        Throwable causa = rootCause(ex);
        if ("23505".equals(sqlState) && causa.getMessage()!=null
                && causa.getMessage().contains("uq_tecnico_ci")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiError.de("CI_YA_REGISTRADO", "Ese CI ya tiene un expediente técnico."));
        }

        if (sqlState == null) {
            log.error("Fallo de acceso a datos sin SQLSTATE", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiError.de("ERROR_INTERNO", "Ocurrió un error inesperado. Probá de nuevo."));
        }

        return switch (sqlState) {
            // Violación de unicidad: el usuario intentó crear algo que ya existe.
            case "23505" -> ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiError.de("REGISTRO_DUPLICADO", "Ya existe un registro con esos datos."));

            // FK inexistente: el cliente referenció algo que no está.
            case "23503" -> ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiError.de("REFERENCIA_INVALIDA", "La referencia indicada no existe."));

            // CHECK / NOT NULL: reglas de negocio que la base rechaza.
            case "23502", "23514" -> ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT)
                    .body(ApiError.de("REGLA_NEGOCIO", "La operación fue rechazada por una regla de negocio."));

            // RAISE EXCEPTION de nuestras funciones: mensaje en español, apto para el usuario.
            case "P0001" -> ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT)
                    .body(ApiError.de("REGLA_NEGOCIO", mensajeDeFuncion(causa)));

            // Permiso denegado en la base (p. ej. app.usuario_id ausente en una escritura administrativa).
            case "42501" -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiError.de("PERMISO_INSUFICIENTE", "No tenés permiso para realizar esta acción."));

            default -> {
                log.error("SQLSTATE no contemplado: {}", sqlState, ex);
                yield ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(ApiError.de("ERROR_INTERNO", "Ocurrió un error inesperado. Probá de nuevo."));
            }
        };
    }

    /**
     * Ruta inexistente: sin este handler el catch-all de abajo la convertiría en
     * 500. Un 404 explícito también deja claro que la seguridad sí dejó pasar.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> recursoNoEncontrado(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.de("RECURSO_NO_ENCONTRADO", "El recurso solicitado no existe."));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> estadoInvalido(IllegalStateException ex) {
        log.error("Estado inválido de la aplicación", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.de("ERROR_INTERNO", "Ocurrió un error inesperado. Probá de nuevo."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> inesperado(Exception ex) {
        log.error("Excepción no contemplada", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.de("ERROR_INTERNO", "Ocurrió un error inesperado. Probá de nuevo."));
    }

    private ApiError.CampoError aCampoError(FieldError error) {
        return new ApiError.CampoError(error.getField(), error.getDefaultMessage());
    }

    /**
     * El mensaje de {@code RAISE} es de nuestras funciones y ya está en español.
     * Si no hay mensaje útil, se usa uno genérico: jamás se filtra el texto crudo.
     */
    private String mensajeDeFuncion(Throwable causa) {
        String mensaje = causa == null ? null : causa.getMessage();
        if (mensaje == null || mensaje.isBlank()) {
            return "La operación fue rechazada por una regla de negocio.";
        }
        // JDBC añade contexto SQL y nombres de funciones después del salto de línea.
        return mensaje.replaceFirst("^ERROR:\\s*", "").split("\\R", 2)[0];
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> archivoGrande(Exception ex) {
        return ResponseEntity.status(413)
                .body(ApiError.de("ARCHIVO_MUY_GRANDE", "Cada archivo puede pesar hasta 8 MB."));
    }

    private String sqlState(Throwable ex) {
        Throwable actual = ex;
        while (actual != null) {
            if (actual instanceof SQLException sql) {
                return sql.getSQLState();
            }
            actual = actual.getCause();
        }
        return null;
    }

    private Throwable rootCause(Throwable ex) {
        Throwable actual = ex;
        while (actual.getCause() != null && actual.getCause() != actual) {
            actual = actual.getCause();
        }
        return actual;
    }
}

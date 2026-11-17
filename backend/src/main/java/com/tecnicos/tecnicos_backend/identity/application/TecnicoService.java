package com.tecnicos.tecnicos_backend.identity.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tecnicos.tecnicos_backend.identity.api.ExpedienteAdminResumen;
import com.tecnicos.tecnicos_backend.identity.api.ExpedienteResponse;
import com.tecnicos.tecnicos_backend.identity.api.LoginResponse;
import com.tecnicos.tecnicos_backend.identity.api.ObservarRequest;
import com.tecnicos.tecnicos_backend.identity.api.OtpSolicitadoResponse;
import com.tecnicos.tecnicos_backend.identity.api.RechazarRequest;
import com.tecnicos.tecnicos_backend.identity.api.ReenviarRequest;
import com.tecnicos.tecnicos_backend.identity.api.TecnicoRegistroRequest;
import com.tecnicos.tecnicos_backend.identity.api.UsuarioResumen;
import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import com.tecnicos.tecnicos_backend.shared.mail.ServicioEmail;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.JwtService;
import com.tecnicos.tecnicos_backend.shared.security.TokenGenerado;
import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.IncorrectResultSizeDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.sql.Array;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Onboarding del técnico: registro, OTP por email y expediente por niveles.
 *
 * <p>Las reglas duras (formato de CI, edad, CI único, OTP, geometría de zonas,
 * aprobación) viven en las funciones de V5; este servicio solo orquesta,
 * normaliza y traduce a respuestas de API. La revisión humana es solo para el
 * tramo documental: nada se aprueba automáticamente sin email verificado y
 * datos completos.</p>
 */
@Service
public class TecnicoService {

    private static final Logger log = LoggerFactory.getLogger(TecnicoService.class);

    private static final Set<String> EXTENSIONES_OK =
            Set.of(".png", ".jpg", ".jpeg", ".pdf");

    private final JdbcTemplate jdbc;
    private final javax.sql.DataSource dataSource;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditoriaContexto auditoria;
    private final ServicioEmail email;
    private final AlmacenArchivos almacen;
    private final ObjectMapper objectMapper;

    @Value("${app.otp.dev-mode:true}")
    private boolean devMode;

    public TecnicoService(JdbcTemplate jdbc, javax.sql.DataSource dataSource,
                          UsuarioRepository usuarios,
                          PasswordEncoder passwordEncoder, JwtService jwtService,
                          AuditoriaContexto auditoria, ServicioEmail email,
                          AlmacenArchivos almacen, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.dataSource = dataSource;
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditoria = auditoria;
        this.email = email;
        this.almacen = almacen;
        this.objectMapper = objectMapper;
    }

    // ------------------------------------------------------------ registro

    @Transactional
    public LoginResponse registrarTecnico(TecnicoRegistroRequest request) {
        auditoria.aplicarEnTransaccion();

        String emailNormalizado = request.email().trim().toLowerCase(Locale.ROOT);
        if (usuarios.existsByEmailIgnoreCase(emailNormalizado)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_YA_REGISTRADO",
                    "Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.");
        }

        Long id = jdbc.queryForObject(
                "SELECT identity.registrar_tecnico(?, ?, ?, ?, ?)", Long.class,
                request.nombre().trim(),
                request.apellido().trim(),
                emailNormalizado,
                textoOLaNada(request.telefono()),
                passwordEncoder.encode(request.password()));

        // El onboarding arranca con OTP: nivel 0, expediente en borrador.
        String codigo = solicitarCodigo(id);
        enviarEmailSeguro(emailNormalizado, codigo);

        Usuario usuario = usuarios.findById(id)
                .orElseThrow(() -> new IllegalStateException(
                        "La función de registro no devolvió un usuario existente."));
        TokenGenerado token = jwtService.generar(usuario.getId(), usuario.getRol(),
                usuario.getTipoCliente(), usuario.getNombreVisible(), usuario.getEmail());

        log.info("Registro de técnico: usuario {} en nivel 0", id);
        return new LoginResponse(token.token(), token.expiraEn(), UsuarioResumen.de(usuario));
    }

    // ------------------------------------------------------------- OTP

    @Transactional
    public OtpSolicitadoResponse solicitarOtp(Long usuarioId) {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);

        String destinatario = jdbc.queryForObject(
                "SELECT email FROM identity.usuarios WHERE id = ?", String.class, usuarioId);
        String codigo = solicitarCodigo(usuarioId);
        enviarEmailSeguro(destinatario, codigo);

        String codigoDev = devMode ? codigo : null;
        return new OtpSolicitadoResponse(
                "Te enviamos un código de 6 dígitos a tu email.", codigoDev);
    }

    @Transactional
    public void confirmarOtp(Long usuarioId, String codigo) {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);

        if (codigo == null || codigo.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DATOS_INVALIDOS",
                    "Ingresá el código de 6 dígitos.");
        }
        Boolean ok = jdbc.queryForObject(
                "SELECT identity.confirmar_codigo_email(?, ?)", Boolean.class,
                usuarioId, codigo.trim());
        if (!Boolean.TRUE.equals(ok)) {
            throw new ApiException(HttpStatus.valueOf(422), "REGLA_NEGOCIO",
                    "No se pudo confirmar el código.");
        }
    }

    // ---------------------------------------------------------- expediente

    @Transactional
    public void guardarDatosPersonales(Long usuarioId, String ci, LocalDate fechaNacimiento) {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);
        jdbc.update("SELECT identity.expediente_datos_personales(?, ?, ?)",
                usuarioId, ci, java.sql.Date.valueOf(fechaNacimiento));
    }

    @Transactional
    public void guardarDocumentos(Long usuarioId, MultipartFile ciFrente, MultipartFile ciDorso,
                                  MultipartFile[] certificaciones) throws IOException {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);

        if (ciFrente == null || ciFrente.isEmpty() || ciDorso == null || ciDorso.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DOCUMENTOS_INCOMPLETOS",
                    "Subí las fotos del CI (frente y dorso).");
        }
        if (certificaciones == null || certificaciones.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DOCUMENTOS_INCOMPLETOS",
                    "Subí al menos un certificado técnico.");
        }

        exigirExtension(ciFrente);
        exigirExtension(ciDorso);
        for (MultipartFile archivo : certificaciones) {
            exigirExtension(archivo);
        }

        String frenteUrl = almacen.guardar(ciFrente.getOriginalFilename(), ciFrente.getInputStream());
        String dorsoUrl = almacen.guardar(ciDorso.getOriginalFilename(), ciDorso.getInputStream());

        List<String> certs = new ArrayList<>();
        for (MultipartFile archivo : certificaciones) {
            if (archivo != null && !archivo.isEmpty()) {
                certs.add(almacen.guardar(archivo.getOriginalFilename(), archivo.getInputStream()));
            }
        }
        if (certs.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DOCUMENTOS_INCOMPLETOS",
                    "Subí al menos un certificado técnico.");
        }

        Array certArray = crearArray("text", certs.toArray());
        jdbc.update("SELECT identity.expediente_documentos(?, ?, ?, ?)",
                usuarioId, frenteUrl, dorsoUrl, certArray);
    }

    @Transactional
    public void guardarEspecialidades(Long usuarioId, List<Integer> categorias) {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);
        Array categoriasArray = crearArray("int", categorias.toArray(new Integer[0]));
        jdbc.update("SELECT identity.expediente_especialidades(?, ?)", usuarioId, categoriasArray);
    }

    @Transactional
    public void guardarZona(Long usuarioId, String nombre, Double lat, Double lng,
                            java.math.BigDecimal radio) {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);
        jdbc.update("SELECT identity.expediente_zona(?, ?, ?, ?, ?)",
                usuarioId, nombre, lat, lng, radio);
    }

    @Transactional
    public void enviarExpediente(Long usuarioId) {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);
        jdbc.update("SELECT identity.expediente_enviar(?)", usuarioId);
    }

    @Transactional
    public void reenviarExpediente(Long usuarioId, ReenviarRequest request) {
        auditoria.aplicarEnTransaccion();
        requerirPerfilTecnico(usuarioId);
        Array campos = crearArray("text", request.campos().toArray(new String[0]));
        jdbc.update("SELECT identity.expediente_reenviar(?, ?)", usuarioId, campos);
    }

    @Transactional(readOnly = true)
    public ExpedienteResponse expediente(Long usuarioId) {
        try {
            return jdbc.queryForObject("""
                    SELECT p.nivel,
                           p.estado_expediente,
                           p.email_verificado_en,
                           p.ci,
                           p.fecha_nacimiento,
                           p.ci_frente_url,
                           p.ci_dorso_url,
                           p.certificaciones_url,
                           p.observaciones::text AS observaciones,
                           p.enviado_en,
                           u.email
                    FROM identity.perfiles_tecnico p
                    JOIN identity.usuarios u ON u.id = p.usuario_id
                    WHERE p.usuario_id = ?
                    """,
                    (rs, n) -> new ExpedienteResponse(
                            rs.getInt("nivel"),
                            rs.getString("estado_expediente"),
                            rs.getString("email"),
                            iso(rs.getObject("email_verificado_en", OffsetDateTime.class)),
                            rs.getString("ci"),
                            iso(rs.getObject("fecha_nacimiento", LocalDate.class)),
                            rs.getString("ci_frente_url"),
                            rs.getString("ci_dorso_url"),
                            strings(rs.getArray("certificaciones_url")),
                            especialidades(usuarioId),
                            zonas(usuarioId),
                            observaciones(rs.getString("observaciones")),
                            iso(rs.getObject("enviado_en", OffsetDateTime.class))));
        } catch (IncorrectResultSizeDataAccessException e) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PERFIL_NO_ENCONTRADO",
                    "Esta cuenta no tiene perfil técnico.");
        }
    }

    public InputStream descargarDocumento(Long usuarioId, RolUsuario rol, String nombre)
            throws IOException {
        if (nombre == null || nombre.isBlank() || nombre.contains("/") || nombre.contains("..")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOMBRE_INVALIDO",
                    "Nombre de archivo inválido.");
        }
        String url = "/perfiles/" + nombre;
        Boolean dueno = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM identity.perfiles_tecnico p
                    WHERE p.usuario_id = ?
                      AND (? = ANY(p.certificaciones_url)
                           OR p.ci_frente_url = ?
                           OR p.ci_dorso_url = ?
                           OR p.selfie_url = ?)
                )
                """, Boolean.class, usuarioId, url, url, url, url);

        if (!Boolean.TRUE.equals(dueno) && rol != RolUsuario.administrador) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NO_AUTORIZADO",
                    "No tenés acceso a ese documento.");
        }
        return almacen.abrir(url);
    }

    // ------------------------------------------------------------- admin

    @Transactional(readOnly = true)
    public List<ExpedienteAdminResumen> expedientes(String estado) {
        String filtro = estado == null || estado.isBlank() ? "en_revision" : estado;
        return jdbc.query("""
                SELECT p.usuario_id AS tecnico_id,
                       u.nombre || ' ' || u.apellido AS nombre,
                       u.email,
                       p.estado_expediente,
                       p.ci,
                       p.ci_frente_url,
                       p.ci_dorso_url,
                       p.certificaciones_url,
                       p.observaciones::text AS observaciones,
                       p.enviado_en
                FROM identity.perfiles_tecnico p
                JOIN identity.usuarios u ON u.id = p.usuario_id
                WHERE p.estado_expediente = ?
                  AND u.eliminado_en IS NULL
                ORDER BY p.enviado_en DESC NULLS LAST, u.id
                """,
                (rs, n) -> new ExpedienteAdminResumen(
                        rs.getLong("tecnico_id"),
                        rs.getString("nombre"),
                        rs.getString("email"),
                        rs.getString("estado_expediente"),
                        rs.getString("ci"),
                        rs.getString("ci_frente_url"),
                        rs.getString("ci_dorso_url"),
                        strings(rs.getArray("certificaciones_url")),
                        observaciones(rs.getString("observaciones")),
                        rs.getObject("enviado_en", OffsetDateTime.class)),
                filtro);
    }

    @Transactional
    public void observar(Long adminId, Long tecnicoId, ObservarRequest request) {
        auditoria.aplicarEnTransaccion();
        try {
            String json = objectMapper.writeValueAsString(request.observaciones());
            jdbc.update("SELECT identity.expediente_observar(?, ?, ?::jsonb)",
                    adminId, tecnicoId, json);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DATOS_INVALIDOS",
                    "Las observaciones no son válidas.");
        }
    }

    @Transactional
    public void aprobar(Long adminId, Long tecnicoId) {
        auditoria.aplicarEnTransaccion();
        jdbc.update("SELECT identity.expediente_aprobar(?, ?)", adminId, tecnicoId);
    }

    @Transactional
    public void rechazar(Long adminId, Long tecnicoId, RechazarRequest request) {
        auditoria.aplicarEnTransaccion();
        jdbc.update("SELECT identity.expediente_rechazar(?, ?, ?)",
                adminId, tecnicoId, request.motivo());
    }

    // ------------------------------------------------------------- utils

    private String solicitarCodigo(Long usuarioId) {
        return jdbc.queryForObject(
                "SELECT identity.solicitar_codigo_email(?)", String.class, usuarioId);
    }

    private void enviarEmailSeguro(String destinatario, String codigo) {
        try {
            email.enviarCodigo(destinatario, codigo);
        } catch (RuntimeException e) {
            // El envío no puede romper el registro: el usuario puede re-pedir el código.
            log.warn("No se pudo enviar el OTP a {}: {}", destinatario, e.getMessage());
        }
    }

    private void requerirPerfilTecnico(Long usuarioId) {
        Boolean existe = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM identity.perfiles_tecnico p
                               WHERE p.usuario_id = ?)
                """, Boolean.class, usuarioId);
        if (!Boolean.TRUE.equals(existe)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PERFIL_NO_ENCONTRADO",
                    "Esta cuenta no tiene perfil técnico.");
        }
    }

    private List<ExpedienteResponse.EspecialidadResumen> especialidades(long usuarioId) {
        return jdbc.query("""
                SELECT cs.id, cs.nombre
                FROM identity.tecnico_especialidades te
                JOIN orders.categorias_servicio cs ON cs.id = te.categoria_id
                WHERE te.tecnico_id = ?
                ORDER BY cs.id
                """, (rs, n) -> new ExpedienteResponse.EspecialidadResumen(
                        rs.getInt("id"), rs.getString("nombre")),
                usuarioId);
    }

    private List<ExpedienteResponse.ZonaResumen> zonas(long usuarioId) {
        return jdbc.query("""
                SELECT id, nombre_zona
                FROM geo.zonas_cobertura
                WHERE tecnico_id = ? AND activo
                ORDER BY id
                """, (rs, n) -> new ExpedienteResponse.ZonaResumen(
                        rs.getLong("id"), rs.getString("nombre_zona")),
                usuarioId);
    }

    private static String iso(Object fecha) {
        if (fecha instanceof OffsetDateTime odt) return odt.toString();
        if (fecha instanceof LocalDate ld) return ld.toString();
        return null;
    }

    private static List<String> strings(Array array) {
        if (array == null) {
            return List.of();
        }
        try {
            Object[] valores = (Object[]) array.getArray();
            List<String> resultado = new ArrayList<>();
            for (Object v : valores) {
                if (v != null) {
                    resultado.add(v.toString());
                }
            }
            return resultado;
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, String> observaciones(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (IOException e) {
            return Map.of();
        }
    }

    private static String textoOLaNada(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }

    private static void exigirExtension(MultipartFile archivo) {
        String nombre = archivo.getOriginalFilename() == null ? "" : archivo.getOriginalFilename();
        int punto = nombre.lastIndexOf('.');
        String extension = punto < 0 ? "" : nombre.substring(punto).toLowerCase(Locale.ROOT);
        if (!EXTENSIONES_OK.contains(extension)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ARCHIVO_NO_PERMITIDO",
                    "Solo se aceptan PNG, JPG o PDF.");
        }
    }

    private Array crearArray(String tipo, Object[] valores) {
        Connection conexion = DataSourceUtils.getConnection(dataSource);
        try {
            return conexion.createArray(tipo, valores);
        } catch (SQLException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DATOS_INVALIDOS",
                    "No se pudieron armar los datos del pedido.");
        }
    }
}

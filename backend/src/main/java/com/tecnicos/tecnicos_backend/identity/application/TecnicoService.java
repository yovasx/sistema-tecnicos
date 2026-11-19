package com.tecnicos.tecnicos_backend.identity.application;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.tecnicos.tecnicos_backend.identity.api.*;
import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import com.tecnicos.tecnicos_backend.shared.mail.ServicioEmail;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.JwtService;
import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.SqlArrayValue;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.sql.Array;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

/** Orquestación del expediente. Reglas y transiciones exclusivamente en Postgres. */
@Service
public class TecnicoService {
    private final JdbcTemplate jdbc;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder claves;
    private final JwtService jwt;
    private final AuditoriaContexto auditoria;
    private final ServicioEmail correo;
    private final AlmacenArchivos almacen;
    private final ObjectMapper json;

    public TecnicoService(JdbcTemplate jdbc, UsuarioRepository usuarios, PasswordEncoder claves,
                          JwtService jwt, AuditoriaContexto auditoria, ServicioEmail correo,
                          AlmacenArchivos almacen, ObjectMapper json) {
        this.jdbc=jdbc; this.usuarios=usuarios; this.claves=claves; this.jwt=jwt;
        this.auditoria=auditoria; this.correo=correo; this.almacen=almacen; this.json=json;
    }

    @Transactional
    public LoginResponse registrarTecnico(TecnicoRegistroRequest r) {
        auditoria.aplicarEnTransaccion();
        String email=r.email().trim().toLowerCase(Locale.ROOT);
        if (usuarios.existsByEmailIgnoreCase(email)) {
            throw error(HttpStatus.CONFLICT,"EMAIL_YA_REGISTRADO","Ya existe una cuenta con ese email. Iniciá sesión.");
        }
        if (r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72) {
            throw error(HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","La contraseña no puede superar 72 bytes.");
        }
        Long id=jdbc.queryForObject("SELECT identity.registrar_tecnico(?,?,?,?,?)",Long.class,
                r.nombre(),r.apellido(),email,r.telefono(),claves.encode(r.password()));
        // El envío se solicita desde la pantalla OTP; falla explícitamente si SMTP no responde.
        var u=usuarios.findById(Objects.requireNonNull(id)).orElseThrow();
        var token=jwt.generar(id,u.getRol(),u.getTipoCliente(),u.getNombreVisible(),u.getEmail());
        return new LoginResponse(token.token(),token.expiraEn(),UsuarioResumen.de(u));
    }

    @Transactional
    public OtpSolicitadoResponse solicitarOtp(Long id) {
        auditoria.aplicarEnTransaccion();
        perfilActivo(id);
        String codigo=jdbc.queryForObject("SELECT identity.solicitar_codigo_email(?)",String.class,id);
        String email=jdbc.queryForObject("SELECT email FROM identity.usuarios WHERE id=?",String.class,id);
        try {
            correo.enviarCodigo(email,codigo);
        } catch (RuntimeException e) {
            // Rollback del código y del cooldown: no afirmar un envío que no ocurrió.
            throw error(HttpStatus.SERVICE_UNAVAILABLE,"EMAIL_NO_DISPONIBLE",
                    "No pudimos enviar el email. Intentá de nuevo en unos minutos.");
        }
        return new OtpSolicitadoResponse("Código enviado. Revisá tu email; vence en 10 minutos.");
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void confirmarOtp(Long id,String codigo) {
        auditoria.aplicarEnTransaccion();
        perfilActivo(id);
        String resultado=jdbc.queryForObject("SELECT identity.confirmar_codigo_email(?,?)",String.class,id,codigo);
        if (!"CONFIRMADO".equals(resultado)) {
            String mensaje=switch (Objects.requireNonNull(resultado)) {
                case "EXPIRADO" -> "El código expiró. Pedí uno nuevo.";
                case "BLOQUEADO" -> "Superaste los 5 intentos. Pedí un código nuevo.";
                case "SIN_CODIGO" -> "Pedí un código nuevo para verificar tu email.";
                default -> "Código incorrecto.";
            };
            // La función no lanza RAISE al fallar: el incremento de intentos persiste.
            throw error(HttpStatus.BAD_REQUEST,"OTP_"+resultado,mensaje);
        }
    }

    @Transactional
    public void guardarDatosPersonales(Long id,String ci,LocalDate fecha) {
        auditoria.aplicarEnTransaccion();
        perfilActivo(id);
        ejecutar("SELECT identity.expediente_datos_personales(?,?,?)",id,ci,java.sql.Date.valueOf(fecha));
    }

    @Transactional(rollbackFor = IOException.class)
    public void guardarDocumentos(Long id,MultipartFile frente,MultipartFile dorso,MultipartFile[] certificados)
            throws IOException {
        auditoria.aplicarEnTransaccion();
        perfilActivo(id);
        ejecutar("SELECT identity.expediente_editable(?)",id);
        List<MultipartFile> certs=certificados==null ? List.of() : Arrays.asList(certificados);
        if (certs.size()>5) throw error(HttpStatus.BAD_REQUEST,"ARCHIVO_NO_PERMITIDO","Máximo 5 certificados.");
        List<MultipartFile> archivos=new ArrayList<>(certs);
        if (frente!=null) archivos.add(frente);
        if (dorso!=null) archivos.add(dorso);
        if (archivos.isEmpty()) throw error(HttpStatus.BAD_REQUEST,"DOCUMENTOS_INCOMPLETOS","Elegí un documento.");
        for (var f:archivos) validarArchivo(f);
        // Guardar referencias previas para retirarlas SOLO después del commit.
        // No conservar copias huérfanas del CI cuando el técnico corrige una foto.
        List<String> anteriores=jdbc.queryForObject("""
            SELECT ci_frente_url,ci_dorso_url,certificaciones_url
            FROM identity.perfiles_tecnico WHERE usuario_id=?
            """,(rs,n)->{
                List<String> lista=new ArrayList<>();
                if (frente!=null && rs.getString("ci_frente_url")!=null) lista.add(rs.getString("ci_frente_url"));
                if (dorso!=null && rs.getString("ci_dorso_url")!=null) lista.add(rs.getString("ci_dorso_url"));
                if (!certs.isEmpty()) lista.addAll(strings(rs.getArray("certificaciones_url")));
                return lista;
            },id);
        String urlFrente=guardar(frente),urlDorso=guardar(dorso);
        List<String> urls=new ArrayList<>();
        for (var f:certs) urls.add(guardar(f));
        ejecutar("SELECT identity.expediente_documentos(?,?,?,?)",id,urlFrente,urlDorso,
                certs.isEmpty()?null:new SqlArrayValue("text",urls.toArray()));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                Objects.requireNonNull(anteriores).forEach(almacen::eliminar);
            }
        });
    }

    private String guardar(MultipartFile f) throws IOException {
        if (f==null) return null;
        String url=almacen.guardar(f.getOriginalFilename(),f.getInputStream());
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status!=STATUS_COMMITTED) almacen.eliminar(url);
            }
        });
        return url;
    }

    private void validarArchivo(MultipartFile f) throws IOException {
        if (f==null || f.isEmpty() || f.getSize()>8*1024*1024) {
            throw error(HttpStatus.BAD_REQUEST,"ARCHIVO_NO_PERMITIDO","Cada documento debe pesar entre 1 byte y 8 MB.");
        }
        String nombre=Objects.toString(f.getOriginalFilename(),"").toLowerCase(Locale.ROOT);
        byte[] cabecera;
        try (var entrada=f.getInputStream()) { cabecera=entrada.readNBytes(8); }
        boolean png=nombre.endsWith(".png") && Arrays.equals(cabecera,
                new byte[]{(byte)137,80,78,71,13,10,26,10});
        boolean jpg=(nombre.endsWith(".jpg")||nombre.endsWith(".jpeg")) && cabecera.length>=3
                && cabecera[0]==(byte)255 && cabecera[1]==(byte)216 && cabecera[2]==(byte)255;
        boolean pdf=nombre.endsWith(".pdf") && cabecera.length>=5
                && new String(cabecera,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-");
        if (!png&&!jpg&&!pdf) throw error(HttpStatus.BAD_REQUEST,"ARCHIVO_NO_PERMITIDO","Usá documentos JPG, PNG o PDF válidos.");
    }

    @Transactional
    public void guardarEspecialidades(Long id,List<Integer> categorias) {
        auditoria.aplicarEnTransaccion(); perfilActivo(id);
        ejecutar("SELECT identity.expediente_especialidades(?,?)",id,new SqlArrayValue("int4",categorias.toArray()));
    }

    @Transactional
    public void guardarZona(Long id,String nombre,Double lat,Double lng,java.math.BigDecimal radio) {
        auditoria.aplicarEnTransaccion(); perfilActivo(id);
        ejecutar("SELECT identity.expediente_zona(?,?,?,?,?)",id,nombre,lat,lng,radio);
    }

    @Transactional
    public void enviarExpediente(Long id) {
        auditoria.aplicarEnTransaccion(); perfilActivo(id);
        ejecutar("SELECT identity.expediente_enviar(?)",id);
    }

    @Transactional(readOnly = true)
    public ExpedienteResponse expediente(Long id) {
        auditoria.aplicarEnTransaccion(); perfilActivo(id);
        return leerExpediente(id);
    }

    /** Solo desde controladores /api/admin: permite revisar cuentas inactivas. */
    @Transactional(readOnly = true)
    public ExpedienteResponse expedienteAdministrativo(Long id) {
        auditoria.aplicarEnTransaccion();
        boolean existe=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.perfiles_tecnico p
            JOIN identity.usuarios u ON u.id=p.usuario_id
            WHERE p.usuario_id=? AND u.rol='tecnico' AND u.eliminado_en IS NULL)
            """,Boolean.class,id));
        if (!existe) throw error(HttpStatus.NOT_FOUND,"TECNICO_NO_ENCONTRADO","El técnico no existe.");
        return leerExpediente(id);
    }

    private ExpedienteResponse leerExpediente(Long id) {
        return jdbc.queryForObject("""
            SELECT p.*,u.email FROM identity.perfiles_tecnico p
            JOIN identity.usuarios u ON u.id=p.usuario_id WHERE p.usuario_id=?
            """,(rs,n)->new ExpedienteResponse(rs.getInt("nivel"),rs.getString("disponibilidad"),rs.getString("estado_expediente"),
                rs.getString("email"),rs.getString("email_verificado_en"),rs.getString("ci"),
                rs.getString("fecha_nacimiento"),rs.getString("ci_frente_url"),rs.getString("ci_dorso_url"),
                strings(rs.getArray("certificaciones_url")),especialidades(id),zonas(id),
                observaciones(rs.getString("observaciones")),rs.getString("enviado_en")),id);
    }

    @Transactional(readOnly = true)
    public List<ExpedienteResponse.EspecialidadResumen> categorias() {
        auditoria.aplicarEnTransaccion();
        return jdbc.query("SELECT id,nombre FROM orders.categorias_servicio WHERE activa ORDER BY id",
                (rs,n)->new ExpedienteResponse.EspecialidadResumen(rs.getInt("id"),rs.getString("nombre")));
    }

    @Transactional(readOnly = true)
    public List<ExpedienteAdminResumen> expedientes(String estado) {
        auditoria.aplicarEnTransaccion();
        if (!Set.of("en_revision","observado","aprobado","rechazado").contains(estado))
            throw error(HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","Estado de expediente inválido.");
        return jdbc.query("""
            SELECT p.*,u.nombre||' '||u.apellido AS nombre,u.email FROM identity.perfiles_tecnico p
            JOIN identity.usuarios u ON u.id=p.usuario_id
            WHERE p.estado_expediente::text=? AND p.expediente_requerido AND u.eliminado_en IS NULL
            ORDER BY p.enviado_en NULLS LAST,p.usuario_id
            """,(rs,n)->new ExpedienteAdminResumen(rs.getLong("usuario_id"),rs.getString("nombre"),
                rs.getString("email"),rs.getString("estado_expediente"),rs.getString("ci"),
                rs.getString("ci_frente_url"),rs.getString("ci_dorso_url"),
                strings(rs.getArray("certificaciones_url")),observaciones(rs.getString("observaciones")),
                rs.getObject("enviado_en",OffsetDateTime.class)),estado);
    }

    @Transactional
    public void observar(Long admin,Long id,ObservarRequest r) {
        auditoria.aplicarEnTransaccion();
        ejecutar("SELECT identity.expediente_observar(?,?,?::jsonb)",admin,id,json.writeValueAsString(r.observaciones()));
    }

    @Transactional
    public void aprobar(Long admin,Long id) {
        auditoria.aplicarEnTransaccion(); ejecutar("SELECT identity.expediente_aprobar(?,?)",admin,id);
    }

    @Transactional
    public void rechazar(Long admin,Long id,RechazarRequest r) {
        auditoria.aplicarEnTransaccion(); ejecutar("SELECT identity.expediente_rechazar(?,?,?)",admin,id,r.motivo());
    }

    public InputStream descargarDocumento(Long id,RolUsuario rol,String nombre) throws IOException {
        if (nombre==null || !nombre.matches("[a-f0-9-]{36}\\.(?i:png|jpg|jpeg|pdf)"))
            throw error(HttpStatus.NOT_FOUND,"DOCUMENTO_NO_ENCONTRADO","Documento no encontrado.");
        String url="/perfiles/"+nombre;
        boolean actorActivo=Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM identity.usuarios WHERE id=? AND activo AND eliminado_en IS NULL)",
                Boolean.class,id));
        if (!actorActivo) throw error(HttpStatus.FORBIDDEN,"SIN_ACCESO","No tenés acceso a este documento.");
        boolean acceso=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.perfiles_tecnico p
            JOIN identity.usuarios u ON u.id=p.usuario_id
            WHERE u.eliminado_en IS NULL AND (p.usuario_id=? OR ?)
            AND (?=p.ci_frente_url OR ?=p.ci_dorso_url OR ?=ANY(p.certificaciones_url)))
            """,Boolean.class,id,rol==RolUsuario.administrador,url,url,url));
        if (!acceso) throw error(HttpStatus.NOT_FOUND,"DOCUMENTO_NO_ENCONTRADO","Documento no encontrado.");
        try { return almacen.abrir(url); }
        catch (java.nio.file.NoSuchFileException e) {
            throw error(HttpStatus.NOT_FOUND,"DOCUMENTO_NO_ENCONTRADO","Documento no encontrado.");
        }
    }

    private void perfilActivo(Long id) {
        boolean existe=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
            WHERE p.usuario_id=? AND u.activo AND u.eliminado_en IS NULL AND u.rol='tecnico')
            """,Boolean.class,id));
        if (!existe) throw error(HttpStatus.FORBIDDEN,"SIN_ACCESO","No tenés acceso a este expediente.");
    }

    private void ejecutar(String sql,Object... args) {
        jdbc.query(sql,rs -> { return (Object)null; },args);
    }

    private List<ExpedienteResponse.EspecialidadResumen> especialidades(Long id) {
        return jdbc.query("""
            SELECT c.id,c.nombre FROM identity.tecnico_especialidades e
            JOIN orders.categorias_servicio c ON c.id=e.categoria_id WHERE e.tecnico_id=? ORDER BY c.id
            """,(rs,n)->new ExpedienteResponse.EspecialidadResumen(rs.getInt("id"),rs.getString("nombre")),id);
    }

    private List<ExpedienteResponse.ZonaResumen> zonas(Long id) {
        return jdbc.query("""
            SELECT id,nombre_zona,ST_Y(ST_Centroid(poligono::geometry)) AS lat,
            ST_X(ST_Centroid(poligono::geometry)) AS lng,
            sqrt(ST_Area(poligono)/pi()) AS radio FROM geo.zonas_cobertura
            WHERE tecnico_id=? AND activo ORDER BY id
            """,(rs,n)->new ExpedienteResponse.ZonaResumen(rs.getLong("id"),rs.getString("nombre_zona"),
                rs.getDouble("lat"),rs.getDouble("lng"),Math.round(rs.getDouble("radio"))),id);
    }

    private List<String> strings(Array array) throws SQLException {
        if (array==null) return List.of();
        try { return Arrays.stream((Object[])array.getArray()).map(Object::toString).toList(); }
        finally { array.free(); }
    }
    private Map<String,String> observaciones(String valor) {
        return json.readValue(valor,new TypeReference<Map<String,String>>(){});
    }
    private ApiException error(HttpStatus estado,String codigo,String mensaje) {
        return new ApiException(estado,codigo,mensaje);
    }
}

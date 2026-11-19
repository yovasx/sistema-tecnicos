package com.tecnicos.tecnicos_backend.orders.application;

import com.tecnicos.tecnicos_backend.orders.api.SolicitudesDtos.*;
import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class SolicitudesService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final AlmacenArchivos almacen;
    private final ObjectMapper json;
    public SolicitudesService(JdbcTemplate jdbc,AuditoriaContexto auditoria,AlmacenArchivos almacen,ObjectMapper json) {
        this.jdbc=jdbc; this.auditoria=auditoria; this.almacen=almacen; this.json=json;
    }
    private record Datos(int categoria,String descripcion,double latitud,double longitud,String referencia,boolean urgencia,String archivo) {}

    @Transactional(rollbackFor=IOException.class)
    public CrearResultado crear(String clave,int categoria,String descripcion,double latitud,double longitud,
                                 String referencia,boolean urgencia,MultipartFile evidencia) throws IOException {
        auditoria.aplicarEnTransaccion();
        UUID uuid;
        try {
            uuid=UUID.fromString(clave);
            if(!uuid.toString().equalsIgnoreCase(clave)) throw new IllegalArgumentException();
        } catch(IllegalArgumentException ex) { throw error(HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","La clave de solicitud no es válida."); }
        if(categoria<1 || descripcion.trim().length()<10 || descripcion.trim().length()>2000
            || referencia.trim().length()<5 || referencia.trim().length()>300
            || !Double.isFinite(latitud) || Math.abs(latitud)>90 || !Double.isFinite(longitud) || Math.abs(longitud)>180) {
            throw error(HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","Revisá la descripción (10–2000 caracteres), dirección (5–300) y coordenadas.");
        }
        String hashArchivo=null;
        if(evidencia!=null) {
            validarArchivo(evidencia);
            try(var entrada=evidencia.getInputStream()) { hashArchivo=hash(entrada); }
            hashArchivo+=extension(evidencia.getOriginalFilename());
        }
        String huella=hash(new ByteArrayInputStream(json.writeValueAsString(new Datos(categoria,descripcion.trim(),
            latitud,longitud,referencia.trim(),urgencia,hashArchivo)).getBytes(StandardCharsets.UTF_8)));
        String url=evidencia==null?null:almacen.guardar(evidencia.getOriginalFilename(),evidencia.getInputStream());
        // Registrar antes de SQL: un rollback también elimina el archivo recién creado.
        final boolean[] conservar={false};
        if(url!=null) TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int estado) {
                if(estado!=STATUS_COMMITTED || !conservar[0]) almacen.eliminar(url);
            }
        });
        var r=jdbc.queryForObject("SELECT * FROM orders.crear_solicitud_cliente(?::uuid,?,?,?,?,?,?,?,?)",
            (rs,n)->new CrearResultado(rs.getLong("orden_id"),"solicitado",rs.getBoolean("creada")),
            uuid.toString(),huella,categoria,descripcion.trim(),latitud,longitud,referencia.trim(),urgencia,url);
        conservar[0]=Objects.requireNonNull(r).creada();
        // Un reintento puede corresponder a una orden que ya avanzó: devolver su estado real.
        String estado=jdbc.queryForObject("SELECT estado::text FROM orders.ordenes_servicio WHERE id=?",String.class,r.id());
        return new CrearResultado(r.id(),estado,r.creada());
    }
    @Transactional(readOnly=true)
    public List<Categoria> categorias() {
        return jdbc.query("""
            SELECT c.id,c.nombre,c.descripcion,t.tarifa_visita,t.tarifa_hora,t.moneda
            FROM orders.categorias_servicio c
            LEFT JOIN LATERAL (
                SELECT tarifa_visita,tarifa_hora,moneda FROM billing.tarifas
                WHERE categoria_id=c.id AND vigente_desde<=CURRENT_DATE
                  AND (vigente_hasta IS NULL OR vigente_hasta>=CURRENT_DATE)
                ORDER BY vigente_desde DESC,id DESC LIMIT 1
            ) t ON TRUE
            WHERE c.activa ORDER BY c.id
            """,(r,n)->new Categoria(r.getInt("id"),r.getString("nombre"),r.getString("descripcion"),
                r.getBigDecimal("tarifa_visita"),r.getBigDecimal("tarifa_hora"),r.getString("moneda")));
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Pagina<Fila> propias(long cliente,int pagina,int tamano) {
        if(pagina<0 || pagina>100000 || tamano<1 || tamano>100) throw error(HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","Página inválida.");
        long total=jdbc.queryForObject("SELECT count(*) FROM orders.ordenes_servicio WHERE cliente_id=?",Long.class,cliente);
        var filas=jdbc.query("""
            SELECT o.id,o.categoria_id,c.nombre,o.estado::text,o.tarifa_urgencia,o.creado_en
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            WHERE o.cliente_id=? ORDER BY o.creado_en DESC,o.id DESC LIMIT ? OFFSET ?
            """,(r,n)->new Fila(r.getLong("id"),r.getInt("categoria_id"),r.getString("nombre"),r.getString("estado"),
                r.getBoolean("tarifa_urgencia"),fecha(r,"creado_en")),cliente,tamano,pagina*tamano);
        return new Pagina<>(filas,total,pagina,tamano);
    }
    @Transactional(readOnly=true)
    public Detalle detalle(long cliente,long id) {
        var filas=jdbc.query("""
            SELECT o.*,c.nombre AS categoria,ST_Y(o.ubicacion_cliente::geometry) AS latitud,
                ST_X(o.ubicacion_cliente::geometry) AS longitud,
                CASE WHEN t.eliminado_en IS NULL THEN NULLIF(concat_ws(' ',t.nombre,t.apellido),'') END AS tecnico
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            LEFT JOIN identity.usuarios t ON t.id=o.tecnico_id WHERE o.id=? AND o.cliente_id=?
            """,(r,n)->new Detalle(r.getLong("id"),r.getInt("categoria_id"),r.getString("categoria"),r.getString("estado"),
                r.getBoolean("tarifa_urgencia"),r.getString("descripcion_falla"),r.getString("direccion_referencia"),
                r.getDouble("latitud"),r.getDouble("longitud"),privado(r.getString("foto_evidencia_url")),
                extensionDeUrl(r.getString("foto_evidencia_url")),
                fecha(r,"creado_en"),fecha(r,"asignado_en"),fecha(r,"llegada_estimada_en"),fecha(r,"llegada_en"),
                fecha(r,"finalizado_en"),r.getString("tecnico"),r.getString("motivo_cancelacion"),fecha(r,"cancelado_en")),id,cliente);
        if(filas.isEmpty()) throw noEncontrada();
        return filas.getFirst();
    }
    public record Archivo(InputStream contenido,String extension) {}
    @Transactional(readOnly=true)
    public Archivo evidencia(UsuarioAutenticado usuario,long id) throws IOException {
        var urls=jdbc.query("""
            SELECT foto_evidencia_url FROM orders.ordenes_servicio
            WHERE id=? AND (cliente_id=? OR ?)
            """,(r,n)->r.getString(1),id,usuario.id(),usuario.rol()==RolUsuario.administrador);
        if(urls.isEmpty() || !privado(urls.getFirst())) throw noEncontrada();
        String url=urls.getFirst();
        try { return new Archivo(almacen.abrir(url),extension(url)); }
        catch(java.nio.file.NoSuchFileException ex) { throw noEncontrada(); }
    }
    private static boolean privado(String url) {
        return url!=null && url.matches("/perfiles/[a-f0-9-]{36}\\.(png|jpg|jpeg|pdf)");
    }
    /** Extensión sin punto para que el cliente nombre el archivo sin leer headers. */
    private static String extensionDeUrl(String url) {
        return privado(url)?url.substring(url.lastIndexOf('.')+1).toLowerCase(Locale.ROOT):null;
    }
    private static OffsetDateTime fecha(ResultSet r,String columna) throws SQLException { return r.getObject(columna,OffsetDateTime.class); }
    private static String extension(String nombre) {
        return nombre==null || !nombre.contains(".")?"":nombre.substring(nombre.lastIndexOf('.')).toLowerCase(Locale.ROOT);
    }
    private static void validarArchivo(MultipartFile f) throws IOException {
        if(f.isEmpty() || f.getSize()>8*1024*1024) throw error(HttpStatus.BAD_REQUEST,"ARCHIVO_NO_PERMITIDO","La evidencia debe pesar entre 1 byte y 8 MB.");
        byte[] cabecera;
        try(var entrada=f.getInputStream()) { cabecera=entrada.readNBytes(8); }
        String ext=extension(f.getOriginalFilename());
        boolean png=ext.equals(".png") && Arrays.equals(cabecera,new byte[]{(byte)137,80,78,71,13,10,26,10});
        boolean jpg=Set.of(".jpg",".jpeg").contains(ext) && cabecera.length>=3
            && cabecera[0]==(byte)255 && cabecera[1]==(byte)216 && cabecera[2]==(byte)255;
        boolean pdf=ext.equals(".pdf") && cabecera.length>=5 && new String(cabecera,0,5,StandardCharsets.US_ASCII).equals("%PDF-");
        if(!png && !jpg && !pdf) throw error(HttpStatus.BAD_REQUEST,"ARCHIVO_NO_PERMITIDO","Elegí una evidencia JPG, PNG o PDF válida.");
    }
    private static String hash(InputStream entrada) throws IOException {
        try {
            var digest=MessageDigest.getInstance("SHA-256"); byte[] buffer=new byte[8192]; int cantidad;
            while((cantidad=entrada.read(buffer))!=-1) digest.update(buffer,0,cantidad);
            return HexFormat.of().formatHex(digest.digest());
        } catch(NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    private static ApiException noEncontrada() { return error(HttpStatus.NOT_FOUND,"ORDEN_NO_ENCONTRADA","La orden o evidencia no está disponible."); }
    private static ApiException error(HttpStatus estado,String codigo,String mensaje) { return new ApiException(estado,codigo,mensaje); }
}

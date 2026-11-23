package com.tecnicos.tecnicos_backend.orders.application;

import com.tecnicos.tecnicos_backend.orders.api.OperacionDtos.*;
import com.tecnicos.tecnicos_backend.orders.api.SolicitudesDtos.Pagina;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import com.tecnicos.tecnicos_backend.shared.security.UsuarioAutenticado;
import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;

/** Orquestación; las decisiones y transiciones se ejecutan en funciones SQL. */
@Service
public class OperacionService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final ObjectMapper json;
    public OperacionService(JdbcTemplate jdbc,AuditoriaContexto auditoria,ObjectMapper json) {
        this.jdbc=jdbc; this.auditoria=auditoria; this.json=json;
    }
    private void habilitado(long id) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.usuarios u JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id
              WHERE u.id=? AND u.activo AND u.eliminado_en IS NULL AND p.estado_validacion='aprobado')
            """,Boolean.class,id))) throw new ApiException(HttpStatus.FORBIDDEN,"TECNICO_NO_HABILITADO","El técnico no está habilitado.");
    }
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public TecnicoPanel panel(long id) {
        habilitado(id);
        // Expira ofertas vencidas y reintenta el despacho de solicitudes sin
        // ofertas pendientes. Se hace al abrir el panel para no depender de un
        // proceso externo y para no escribir en cada consulta del cliente.
        jdbc.queryForObject("SELECT orders.mantener_ofertas()",Integer.class);
        String disponibilidad=jdbc.queryForObject("SELECT disponibilidad::text FROM identity.perfiles_tecnico WHERE usuario_id=?",String.class,id);
        long finalizados=jdbc.queryForObject("SELECT count(*) FROM orders.ordenes_servicio WHERE tecnico_id=? AND estado='finalizado'",Long.class,id);
        long activos=jdbc.queryForObject("SELECT count(*) FROM orders.ordenes_servicio WHERE tecnico_id=? AND estado NOT IN ('finalizado','cancelado')",Long.class,id);
        var ofertas=jdbc.query("""
            SELECT f.id oferta,o.id orden,c.nombre categoria,o.tarifa_urgencia,f.distancia_metros,
              f.enviada_en,f.expira_en
            FROM orders.ofertas_orden f
            JOIN orders.ordenes_servicio o ON o.id=f.orden_id
            JOIN orders.categorias_servicio c ON c.id=o.categoria_id AND c.activa
            WHERE f.tecnico_id=? AND f.estado='enviada' AND f.expira_en>clock_timestamp()
              AND o.estado='solicitado' AND o.tecnico_id IS NULL
            ORDER BY f.expira_en,f.id LIMIT 20
            """,(r,n)->new Oferta(r.getLong("oferta"),r.getLong("orden"),r.getString("categoria"),
                r.getBoolean("tarifa_urgencia"),r.getBigDecimal("distancia_metros"),
                r.getObject("enviada_en",OffsetDateTime.class),r.getObject("expira_en",OffsetDateTime.class)),id);
        var candidatos=jdbc.query("""
            SELECT o.id,c.nombre categoria,o.estado::text,o.tarifa_urgencia,o.creado_en
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id AND c.activa
            JOIN identity.usuarios u ON u.id=o.cliente_id AND u.activo AND u.eliminado_en IS NULL
            WHERE o.estado='solicitado' AND o.tecnico_id IS NULL
              AND EXISTS(SELECT 1 FROM identity.tecnico_especialidades e WHERE e.tecnico_id=? AND e.categoria_id=o.categoria_id)
              AND EXISTS(SELECT 1 FROM geo.zonas_cobertura z WHERE z.tecnico_id=? AND z.activo
                AND ST_Covers(z.poligono::geometry,o.ubicacion_cliente::geometry))
              AND ?='disponible' AND ?=0 ORDER BY o.tarifa_urgencia DESC,o.creado_en,o.id LIMIT 30
            """,(r,n)->new Servicio(r.getLong("id"),r.getString("categoria"),r.getString("estado"),
                r.getBoolean("tarifa_urgencia"),r.getObject("creado_en",OffsetDateTime.class)),id,id,disponibilidad,activos);
        return new TecnicoPanel(disponibilidad,finalizados,activos,ofertas,candidatos);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Pagina<Servicio> servicios(long id,int pagina) {
        habilitado(id); pagina(pagina);
        long total=jdbc.queryForObject("SELECT count(*) FROM orders.ordenes_servicio WHERE tecnico_id=?",Long.class,id);
        var lista=jdbc.query("""
            SELECT o.id,c.nombre categoria,o.estado::text,o.tarifa_urgencia,o.creado_en
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            WHERE o.tecnico_id=? ORDER BY (o.estado NOT IN ('finalizado','cancelado')) DESC,o.creado_en DESC,o.id DESC LIMIT 20 OFFSET ?
            """,(r,n)->new Servicio(r.getLong("id"),r.getString("categoria"),r.getString("estado"),
                r.getBoolean("tarifa_urgencia"),r.getObject("creado_en",OffsetDateTime.class)),id,pagina*20);
        return new Pagina<>(lista,total,pagina,20);
    }
    @Transactional(readOnly=true)
    public DetalleTecnico detalle(long tecnico,long orden) {
        habilitado(tecnico);
        var lista=jdbc.query("""
            SELECT o.*,c.nombre categoria,ST_Y(o.ubicacion_cliente::geometry) latitud,ST_X(o.ubicacion_cliente::geometry) longitud,
              CASE WHEN u.eliminado_en IS NULL THEN concat_ws(' ',u.nombre,u.apellido) END cliente,
              cal.puntaje::int mi_calificacion
            FROM orders.ordenes_servicio o JOIN orders.categorias_servicio c ON c.id=o.categoria_id
            JOIN identity.usuarios u ON u.id=o.cliente_id
            LEFT JOIN reputation.calificaciones cal ON cal.orden_id=o.id AND cal.calificador_id=?
            WHERE o.id=? AND o.tecnico_id=?
            """,(r,n)->new DetalleTecnico(r.getLong("id"),r.getString("categoria"),r.getString("estado"),
                r.getString("descripcion_falla"),r.getString("direccion_referencia"),r.getDouble("latitud"),r.getDouble("longitud"),
                r.getString("cliente"),r.getObject("creado_en",OffsetDateTime.class),r.getObject("mi_calificacion",Integer.class)),
            tecnico,orden,tecnico);
        if(lista.isEmpty()) throw ausente();
        return lista.getFirst();
    }
    @Transactional public void disponibilidad(boolean disponible) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT orders.cambiar_disponibilidad(?)",String.class,disponible);
    }
    @Transactional public void tomar(long orden) {
        auditoria.aplicarEnTransaccion();
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT orders.tomar_servicio(?)",Boolean.class,orden)))
            throw new ApiException(HttpStatus.CONFLICT,"SERVICIO_NO_DISPONIBLE","La solicitud ya fue asignada.");
    }
    /** Acepta una oferta despachada por el match; la base resuelve la carrera. */
    @Transactional public void aceptarOferta(long tecnico,long oferta) {
        habilitado(tecnico);
        auditoria.aplicarEnTransaccion();
        if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT orders.aceptar_oferta(?,?)",Boolean.class,oferta,tecnico)))
            return;
        // Reintentar la propia aceptación no es un conflicto.
        boolean propia=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM orders.ofertas_orden f
              JOIN orders.ordenes_servicio o ON o.id=f.orden_id
              WHERE f.id=? AND f.tecnico_id=? AND f.estado='aceptada' AND o.tecnico_id=?)
            """,Boolean.class,oferta,tecnico,tecnico));
        if(!propia) throw new ApiException(HttpStatus.CONFLICT,"OFERTA_NO_DISPONIBLE",
            "La oferta expiró o otro técnico llegó antes. Actualiza el panel.");
    }
    /** Rechaza una oferta propia para que el match busque otro técnico. */
    @Transactional public void rechazarOferta(long tecnico,long oferta) {
        habilitado(tecnico);
        auditoria.aplicarEnTransaccion();
        var estados=jdbc.queryForList("""
            SELECT estado::text FROM orders.ofertas_orden
            WHERE id=? AND tecnico_id=? FOR UPDATE
            """,String.class,oferta,tecnico);
        if(estados.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"OFERTA_NO_DISPONIBLE",
            "La oferta no está disponible.");
        if(!estados.getFirst().equals("enviada")) throw new ApiException(HttpStatus.CONFLICT,
            "OFERTA_NO_DISPONIBLE","La oferta ya fue respondida.");
        jdbc.query("SELECT orders.rechazar_oferta(?,?,?)",(r,n)->null,oferta,tecnico,
            "El técnico no puede atenderla ahora.");
    }
    @Transactional public void avanzar(long orden,String accion) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT orders.avanzar_servicio_propio(?,?)",(r,n)->null,orden,accion);
    }
    @Transactional public void cancelar(long orden,String motivo) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT orders.cancelar_solicitud_propia(?,?)",(r,n)->null,orden,motivo);
    }
    private void participante(UsuarioAutenticado u,long orden) {
        if(u.rol()!=RolUsuario.cliente && u.rol()!=RolUsuario.tecnico) throw ausente();
        if(u.rol()==RolUsuario.tecnico) habilitado(u.id());
        String columna=u.rol()==RolUsuario.cliente?"cliente_id":"tecnico_id";
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM orders.ordenes_servicio WHERE id=? AND "+columna+"=?)",
            Boolean.class,orden,u.id()))) throw ausente();
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public List<Cotizacion> cotizaciones(UsuarioAutenticado u,long orden) {
        participante(u,orden);
        // Últimas 50 versiones enviadas; la UI informa el límite.
        return jdbc.query("""
            SELECT id,version,estado::text,motivo,total,moneda,expira_en
            FROM billing.cotizaciones WHERE orden_id=? AND estado<>'borrador' ORDER BY version DESC LIMIT 50
            """,(r,n)->new Cotizacion(r.getLong("id"),r.getInt("version"),r.getString("estado"),r.getString("motivo"),
                r.getBigDecimal("total"),r.getString("moneda"),r.getObject("expira_en",OffsetDateTime.class),
                jdbc.query("""
                    SELECT tipo::text,descripcion,cantidad,precio_unitario,subtotal FROM billing.cotizacion_items WHERE cotizacion_id=? ORDER BY id
                    """,(i,k)->new Item(i.getString(1),i.getString(2),i.getBigDecimal(3),i.getBigDecimal(4),i.getBigDecimal(5)),
                    r.getLong("id"))),orden);
    }
    @Transactional public long cotizar(long orden,NuevaCotizacion r) {
        auditoria.aplicarEnTransaccion();
        return jdbc.queryForObject("SELECT billing.preparar_cotizacion_propia(?,?::uuid,?,?::jsonb)",Long.class,
            orden,r.clave().toString(),r.motivo(),json.writeValueAsString(r.items()));
    }
    @Transactional public String responder(UsuarioAutenticado u,long orden,long cotizacion,Respuesta r) {
        auditoria.aplicarEnTransaccion(); participante(u,orden);
        // Mismo orden de locks que creación y avance: cuenta -> orden -> cotización.
        var cuentas=jdbc.queryForList("SELECT id FROM identity.usuarios WHERE id=? AND activo AND eliminado_en IS NULL FOR SHARE",u.id());
        if(cuentas.isEmpty()) throw new ApiException(HttpStatus.FORBIDDEN,"CUENTA_NO_DISPONIBLE","La cuenta no está disponible.");
        var ordenes=jdbc.queryForList("""
            SELECT id FROM orders.ordenes_servicio WHERE id=? AND cliente_id=?
              AND estado IN ('en_diagnostico','en_reparacion') FOR UPDATE
            """,orden,u.id());
        if(ordenes.isEmpty()) throw ausente();
        var estados=jdbc.queryForList("SELECT estado::text FROM billing.cotizaciones WHERE id=? AND orden_id=? FOR UPDATE",String.class,cotizacion,orden);
        if(estados.isEmpty()) throw ausente();
        String destino=r.acepta()?"aceptada":"rechazada";
        if(estados.getFirst().equals(destino)) return destino;
        if(!estados.getFirst().equals("enviada")) throw new ApiException(HttpStatus.CONFLICT,"COTIZACION_CAMBIO","La cotización ya no está pendiente.");
        return jdbc.queryForObject("SELECT billing.responder_cotizacion(?,?,?,?)::text",String.class,cotizacion,u.id(),r.acepta(),r.motivo());
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Pagina<Liquidacion> liquidaciones(long tecnico,int pagina) {
        habilitado(tecnico); pagina(pagina);
        long total=jdbc.queryForObject("SELECT count(*) FROM billing.liquidaciones WHERE tecnico_id=?",Long.class,tecnico);
        var filas=jdbc.query("""
            SELECT l.*,c.moneda FROM billing.liquidaciones l JOIN billing.pagos p ON p.id=l.pago_id
            JOIN billing.cotizaciones c ON c.id=p.cotizacion_id WHERE l.tecnico_id=? ORDER BY l.id DESC LIMIT 20 OFFSET ?
            """,(r,n)->new Liquidacion(r.getLong("id"),r.getLong("orden_id"),r.getBigDecimal("monto_bruto"),
                r.getBigDecimal("comision_monto"),r.getBigDecimal("neto_tecnico"),r.getString("moneda"),
                r.getString("estado"),r.getObject("creada_en",OffsetDateTime.class)),tecnico,pagina*20);
        return new Pagina<>(filas,total,pagina,20);
    }
    private void pagina(int p) {
        if(p<0 || p>100000) throw new ApiException(HttpStatus.BAD_REQUEST,"PAGINA_INVALIDA","La página no es válida.");
    }
    private static ApiException ausente() { return new ApiException(HttpStatus.NOT_FOUND,"SERVICIO_NO_DISPONIBLE","El servicio no está disponible."); }
}

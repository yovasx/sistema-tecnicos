package com.tecnicos.tecnicos_backend.geo.application;

import com.tecnicos.tecnicos_backend.geo.api.CoberturaDtos.*;
import com.tecnicos.tecnicos_backend.orders.api.SolicitudesDtos.Pagina;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;

@Service
public class CoberturaService {
    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final ObjectMapper json;
    public CoberturaService(JdbcTemplate jdbc,AuditoriaContexto auditoria,ObjectMapper json) {
        this.jdbc=jdbc; this.auditoria=auditoria; this.json=json;
    }
    private void habilitado(long id,boolean admin) {
        boolean existe=Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.usuarios u JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id
              WHERE u.id=? AND (CAST(? AS boolean) OR (u.activo AND u.eliminado_en IS NULL AND p.estado_validacion='aprobado')))
            """,Boolean.class,id,admin));
        if(!existe) throw new ApiException(HttpStatus.NOT_FOUND,"COBERTURA_NO_DISPONIBLE","La cobertura no está disponible.");
    }
    private void pagina(int p) {
        if(p<0 || p>100000) throw new ApiException(HttpStatus.BAD_REQUEST,"PAGINA_INVALIDA","La página no es válida.");
    }
    private Solicitud solicitud(ResultSet r,int n) throws SQLException {
        return new Solicitud(r.getLong("id"),r.getLong("tecnico_id"),r.getLong("revision"),
            r.getString("estado"),r.getString("motivo"),json.readTree(r.getString("zonas")),
            r.getObject("creada_en",OffsetDateTime.class),r.getObject("revisada_en",OffsetDateTime.class),r.getString("motivo_revision"));
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Vista consultar(long id,int p,boolean admin) {
        pagina(p); habilitado(id,admin);
        long revision=jdbc.queryForObject("SELECT COALESCE((SELECT revision FROM geo.control_cobertura WHERE tecnico_id=?),0)",Long.class,id);
        var zonas=json.readTree(jdbc.queryForObject("SELECT geo.cobertura_json(?)::text",String.class,id));
        var especialidades=jdbc.queryForList("""
            SELECT c.nombre FROM identity.tecnico_especialidades e JOIN orders.categorias_servicio c ON c.id=e.categoria_id
            WHERE e.tecnico_id=? ORDER BY c.nombre
            """,String.class,id);
        long total=jdbc.queryForObject("SELECT count(*) FROM geo.solicitudes_cobertura WHERE tecnico_id=?",Long.class,id);
        var solicitudes=jdbc.query("SELECT * FROM geo.solicitudes_cobertura WHERE tecnico_id=? ORDER BY id DESC LIMIT 20 OFFSET ?",
            this::solicitud,id,p*20);
        return new Vista(revision,zonas,especialidades,solicitudes,total,p);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Pagina<Solicitud> pendientes(int p) {
        pagina(p);
        long total=jdbc.queryForObject("SELECT count(*) FROM geo.solicitudes_cobertura WHERE estado='pendiente'",Long.class);
        return new Pagina<>(jdbc.query("SELECT * FROM geo.solicitudes_cobertura WHERE estado='pendiente' ORDER BY id LIMIT 20 OFFSET ?",
            this::solicitud,p*20),total,p,20);
    }
    @Transactional public long proponer(Propuesta r) {
        auditoria.aplicarEnTransaccion();
        return jdbc.queryForObject("SELECT geo.solicitar_cobertura(?::uuid,?,?,?::jsonb)",Long.class,
            r.clave().toString(),r.revision(),r.motivo(),json.writeValueAsString(r.zonas()));
    }
    @Transactional public void retirar(long id) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT geo.retirar_solicitud_cobertura(?)",(r,n)->null,id);
    }
    @Transactional public void revisar(long id,Decision d) {
        auditoria.aplicarEnTransaccion();
        jdbc.queryForObject("SELECT geo.revisar_solicitud_cobertura(?,?,?,?)",(r,n)->null,id,d.revision(),d.aprobar(),d.motivo());
    }
    /** Consulta puntual: no persiste el punto ni abre sesiones GPS. */
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Pertenencia comprobar(long id,Punto p) {
        habilitado(id,false);
        long revision=jdbc.queryForObject("SELECT COALESCE((SELECT revision FROM geo.control_cobertura WHERE tecnico_id=?),0)",Long.class,id);
        if(!Double.isFinite(p.latitud()) || !Double.isFinite(p.longitud()))
            throw new ApiException(HttpStatus.BAD_REQUEST,"PUNTO_INVALIDO","Revisa las coordenadas.");
        if(p.precision()==null || !Double.isFinite(p.precision()) || p.precision()<0 || p.precision()>200
            || p.capturadoEn()==null || p.capturadoEn().isBefore(OffsetDateTime.now().minusSeconds(30))
            || p.capturadoEn().isAfter(OffsetDateTime.now().plusSeconds(5)))
            return new Pertenencia("ubicacion_insuficiente",false,null,revision);
        return jdbc.queryForObject("""
            WITH zona AS (SELECT ST_UnaryUnion(ST_Collect(poligono::geometry)) g
                FROM geo.zonas_cobertura WHERE tecnico_id=? AND activo),
            punto AS (SELECT ST_SetSRID(ST_MakePoint(?,?),4326) g),
            calculo AS (SELECT zona.g IS NULL vacia,COALESCE(ST_Covers(zona.g,punto.g),false) dentro,
                ST_Distance(ST_Boundary(zona.g)::geography,punto.g::geography) distancia FROM zona,punto)
            SELECT * FROM calculo
            """,(r,n)-> {
                Double distancia=r.getObject("distancia",Double.class);
                boolean dentro=r.getBoolean("dentro");
                String estado=r.getBoolean("vacia")?"sin_cobertura":
                    distancia!=null && distancia<=Math.max(25,p.precision())?"cerca_limite":dentro?"dentro":"fuera";
                return new Pertenencia(estado,dentro,distancia,revision);
            },id,p.longitud(),p.latitud());
    }
}

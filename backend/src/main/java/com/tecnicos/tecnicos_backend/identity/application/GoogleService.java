package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.identity.api.*;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
import com.tecnicos.tecnicos_backend.identity.domain.Usuario;
import com.tecnicos.tecnicos_backend.identity.domain.RolUsuario;
import com.tecnicos.tecnicos_backend.identity.domain.TipoCliente;
import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.security.JwtService;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.security.SecureRandom;

@Service
public class GoogleService {
    @org.springframework.beans.factory.annotation.Value("${app.empresa-local:true}")
    private boolean empresaLocal;
    private final JdbcTemplate jdbc;
    private final VerificadorGoogle verificador;
    private final UsuarioRepository usuarios;
    private final JwtService jwt;
    private final org.springframework.security.crypto.password.PasswordEncoder claves;
    private final AuditoriaContexto auditoria;
    public GoogleService(JdbcTemplate jdbc,VerificadorGoogle verificador,UsuarioRepository usuarios,JwtService jwt,
                          org.springframework.security.crypto.password.PasswordEncoder claves,AuditoriaContexto auditoria) {
        this.jdbc=jdbc; this.verificador=verificador; this.usuarios=usuarios; this.jwt=jwt;
        this.claves=claves; this.auditoria=auditoria;
    }
    @Transactional
    public String desafio(GoogleController.Proposito proposito) {
        if(empresaLocal && proposito==GoogleController.Proposito.tecnico)
            throw new ApiException(HttpStatus.FORBIDDEN,"ALTA_POR_INVITACION","Los técnicos se incorporan mediante invitación de coordinación.");
        auditoria.aplicarEnTransaccion();
        if (!verificador.habilitado()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
            "GOOGLE_NO_CONFIGURADO","El acceso con Google todavía no está configurado.");
        byte[] bytes=new byte[32]; new SecureRandom().nextBytes(bytes);
        String nonce=HexFormat.of().formatHex(bytes);
        jdbc.update("DELETE FROM identity.desafios_google WHERE expira_en<clock_timestamp()");
        jdbc.update("INSERT INTO identity.desafios_google(nonce_hash,proposito) VALUES(encode(digest(?,'sha256'),'hex'),?)",
            nonce,proposito.name());
        return nonce;
    }
    @Transactional
    public LoginResponse login(String token,String nonce,String nombre,String apellido) {
        auditoria.aplicarEnTransaccion();
        var perfil=verificador.verificar(token,nonce);
        var proposito=preparar(nonce,perfil.getSubject());
        if (proposito.equals("vinculacion")) throw contextoInvalido();
        Long id=jdbc.query("SELECT usuario_id FROM identity.identidades_google WHERE sujeto=?",
            (rs,n)->rs.getLong(1),perfil.getSubject()).stream().findFirst().orElse(null);
        if (id==null) {
            if(empresaLocal && proposito.equals("tecnico"))
                throw new ApiException(HttpStatus.FORBIDDEN,"ALTA_POR_INVITACION","Los técnicos se incorporan mediante invitación de coordinación.");
            String email=perfil.getClaimAsString("email").toLowerCase(Locale.ROOT);
            var existente=usuarios.findByEmailIgnoreCase(email);
            if (existente.isPresent()) {
                var cuenta=existente.get();
                if (!compatible(cuenta))
                    throw new ApiException(HttpStatus.CONFLICT,"GOOGLE_CUENTA_NO_COMPATIBLE",
                        "Esta cuenta no admite acceso con Google. Inicia sesión con tu método habitual. Google está disponible para clientes personales y técnicos.");
                // Una cuenta exclusivamente Google no puede seguir instrucciones de contraseña.
                if (cuenta.getPasswordHash()==null) throw new ApiException(HttpStatus.CONFLICT,
                    "GOOGLE_IDENTIDAD_DIFERENTE",
                    "Ese correo ya está registrado con otra identidad Google. Selecciona la cuenta Google con la que te registraste; no necesitas crear otra cuenta ni recuperar una contraseña.");
                throw new ApiException(HttpStatus.CONFLICT,"GOOGLE_VINCULACION_REQUERIDA",
                    "Ese correo ya tiene una cuenta. Inicia sesión con tu contraseña para vincular Google desde Mi cuenta.");
            }
            if (proposito.equals("acceso")) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                "GOOGLE_REGISTRO_REQUERIDO",
                "Esta cuenta Google aún no está registrada. Selecciona si deseas crear una cuenta de cliente personal o de técnico.");
            nombre=texto(perfil.getClaimAsString("given_name"),nombre);
            apellido=texto(perfil.getClaimAsString("family_name"),apellido);
            if (nombre==null || apellido==null) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT,"GOOGLE_DATOS_REQUERIDOS",
                "Completa tu nombre y apellido para crear la cuenta.");
            id=jdbc.queryForObject("SELECT identity.registrar_google_cuenta(?,?,?,?,?)",Long.class,
                perfil.getSubject(),email,nombre,apellido,proposito);
        }
        // Serializar también contra desactivaciones y cambios de contraseña.
        jdbc.queryForList("SELECT id FROM identity.usuarios WHERE id=? FOR SHARE",Long.class,id);
        var u=usuarios.findById(Objects.requireNonNull(id)).orElseThrow();
        if (!u.isActivo() || u.isEliminado() || !compatible(u))
            throw new ApiException(HttpStatus.UNAUTHORIZED,"GOOGLE_INVALIDO","Esta cuenta no tiene acceso con Google.");
        consumir(nonce);
        var t=jwt.generar(id,u.getRol(),u.getTipoCliente(),u.getNombreVisible(),u.getEmail());
        return new LoginResponse(t.token(),t.expiraEn(),UsuarioResumen.de(u));
    }
    @Transactional
    public void vincular(Long id,String token,String nonce,String password) {
        auditoria.aplicarEnTransaccion();
        org.springframework.security.oauth2.jwt.Jwt perfil;
        try {
            perfil=verificador.verificar(token,nonce);
            if (!preparar(nonce,perfil.getSubject()).equals("vinculacion")) throw contextoInvalido();
        } catch (ApiException e) {
            // Una credencial Google vencida no significa que el JWT local venció.
            // El 401 se reserva para la autenticación de la petición protegida.
            if (e.estado()==HttpStatus.UNAUTHORIZED)
                throw new ApiException(HttpStatus.BAD_REQUEST,e.codigo(),e.getMessage());
            throw e;
        }
        jdbc.queryForList("SELECT id FROM identity.usuarios WHERE id=? FOR UPDATE",Long.class,id);
        var u=usuarios.findById(id).orElseThrow();
        if (!u.isActivo() || u.isEliminado() || !compatible(u)
            || u.getPasswordHash()==null || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72
            || !claves.matches(password,u.getPasswordHash())
            || !u.getEmail().equalsIgnoreCase(perfil.getClaimAsString("email")))
            throw new ApiException(HttpStatus.BAD_REQUEST,"VINCULACION_INVALIDA",
                "Necesitas tu contraseña actual y una cuenta Google con el mismo correo.");
        consumir(nonce);
        jdbc.queryForObject("SELECT identity.vincular_google_cuenta(?,?)",Object.class,id,perfil.getSubject());
    }
    private boolean compatible(Usuario u) {
        return u.getRol()==RolUsuario.tecnico
            || (u.getRol()==RolUsuario.cliente && u.getTipoCliente()==TipoCliente.persona);
    }
    private ApiException contextoInvalido() {
        return new ApiException(HttpStatus.BAD_REQUEST,"GOOGLE_CONTEXTO_INVALIDO",
            "Este acceso se inició para otra operación. Vuelve a iniciar el proceso desde la opción correspondiente.");
    }
    private String preparar(String nonce,String sujeto) {
        var propositos=jdbc.queryForList("""
            SELECT proposito FROM identity.desafios_google
            WHERE nonce_hash=encode(digest(?,'sha256'),'hex') AND NOT consumido AND expira_en>clock_timestamp()
            FOR UPDATE
            """,String.class,nonce);
        if (propositos.isEmpty()) throw new ApiException(HttpStatus.UNAUTHORIZED,"GOOGLE_INVALIDO",
            "Este acceso venció o ya fue usado. Vuelve a intentarlo.");
        // El mismo lock del registro SQL cubre consulta, alta y vinculación.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?,7248))",Object.class,sujeto);
        return propositos.getFirst();
    }
    private void consumir(String nonce) {
        int usado=jdbc.update("""
            UPDATE identity.desafios_google SET consumido=TRUE
            WHERE nonce_hash=encode(digest(?,'sha256'),'hex') AND NOT consumido AND expira_en>clock_timestamp()
            """,nonce);
        if (usado!=1) throw new ApiException(HttpStatus.UNAUTHORIZED,"GOOGLE_INVALIDO","Este acceso venció o ya fue usado.");
    }
    private String texto(String valor,String alternativo) {
        String v=valor==null || valor.isBlank()?alternativo:valor;
        return v!=null && v.trim().length()>=2 && v.trim().length()<=100?v.trim():null;
    }
}

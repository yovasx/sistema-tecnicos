package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.identity.api.*;
import com.tecnicos.tecnicos_backend.identity.infrastructure.UsuarioRepository;
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
    private final JdbcTemplate jdbc;
    private final VerificadorGoogle verificador;
    private final UsuarioRepository usuarios;
    private final JwtService jwt;
    private final org.springframework.security.crypto.password.PasswordEncoder claves;
    public GoogleService(JdbcTemplate jdbc,VerificadorGoogle verificador,UsuarioRepository usuarios,JwtService jwt,
                         org.springframework.security.crypto.password.PasswordEncoder claves) {
        this.jdbc=jdbc; this.verificador=verificador; this.usuarios=usuarios; this.jwt=jwt;
        this.claves=claves;
    }
    @Transactional
    public String desafio() {
        if (!verificador.habilitado()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
            "GOOGLE_NO_CONFIGURADO","El acceso con Google todavía no está configurado.");
        byte[] bytes=new byte[32]; new SecureRandom().nextBytes(bytes);
        String nonce=HexFormat.of().formatHex(bytes);
        jdbc.update("DELETE FROM identity.desafios_google WHERE expira_en<clock_timestamp()");
        jdbc.update("INSERT INTO identity.desafios_google(nonce_hash) VALUES(encode(digest(?,'sha256'),'hex'))",nonce);
        return nonce;
    }
    @Transactional
    public LoginResponse login(String token,String nonce,String nombre,String apellido) {
        var perfil=verificador.verificar(token,nonce);
        // Falta de datos permite reintentar con el mismo desafío sin guardar tokens en el cliente.
        Long id=jdbc.query("SELECT usuario_id FROM identity.identidades_google WHERE sujeto=?",
            (rs,n)->rs.getLong(1),perfil.getSubject()).stream().findFirst().orElse(null);
        if (id==null) {
            String email=perfil.getClaimAsString("email").toLowerCase(Locale.ROOT);
            if (usuarios.existsByEmailIgnoreCase(email)) throw new ApiException(HttpStatus.CONFLICT,"GOOGLE_VINCULACION_REQUERIDA",
                "Ese correo ya tiene una cuenta. Iniciá sesión con tu contraseña; no vinculamos cuentas automáticamente.");
            nombre=texto(perfil.getClaimAsString("given_name"),nombre);
            apellido=texto(perfil.getClaimAsString("family_name"),apellido);
            if (nombre==null || apellido==null) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT,"GOOGLE_DATOS_REQUERIDOS",
                "Completá tu nombre y apellido para crear la cuenta.");
            id=jdbc.queryForObject("SELECT identity.registrar_google(?,?,?,?)",Long.class,perfil.getSubject(),email,nombre,apellido);
        }
        consumir(nonce);
        var u=usuarios.findById(Objects.requireNonNull(id)).orElseThrow();
        if (!u.isActivo() || u.isEliminado() || u.getRol()!=com.tecnicos.tecnicos_backend.identity.domain.RolUsuario.cliente
            || u.getTipoCliente()!=com.tecnicos.tecnicos_backend.identity.domain.TipoCliente.persona)
            throw new ApiException(HttpStatus.UNAUTHORIZED,"GOOGLE_INVALIDO","Esta cuenta no tiene acceso con Google.");
        var t=jwt.generar(id,u.getRol(),u.getTipoCliente(),u.getNombreVisible(),u.getEmail());
        return new LoginResponse(t.token(),t.expiraEn(),UsuarioResumen.de(u));
    }
    @Transactional
    public void vincular(Long id,String token,String nonce,String password) {
        var perfil=verificador.verificar(token,nonce);
        jdbc.queryForList("SELECT id FROM identity.usuarios WHERE id=? FOR UPDATE",Long.class,id);
        var u=usuarios.findById(id).orElseThrow();
        if (!u.isActivo() || u.isEliminado() || u.getRol()!=com.tecnicos.tecnicos_backend.identity.domain.RolUsuario.cliente
            || u.getTipoCliente()!=com.tecnicos.tecnicos_backend.identity.domain.TipoCliente.persona
            || u.getPasswordHash()==null || !claves.matches(password,u.getPasswordHash())
            || !u.getEmail().equalsIgnoreCase(perfil.getClaimAsString("email")))
            throw new ApiException(HttpStatus.BAD_REQUEST,"VINCULACION_INVALIDA",
                "Necesitás tu contraseña actual y una cuenta Google con el mismo correo.");
        consumir(nonce);
        if (!jdbc.queryForList("SELECT usuario_id FROM identity.identidades_google WHERE sujeto=? OR usuario_id=?",
            Long.class,perfil.getSubject(),id).isEmpty())
            throw new ApiException(HttpStatus.CONFLICT,"GOOGLE_YA_VINCULADO","La cuenta ya tiene una vinculación con Google.");
        jdbc.update("INSERT INTO identity.identidades_google(sujeto,usuario_id) VALUES(?,?)",perfil.getSubject(),id);
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
        return v!=null && !v.isBlank() && v.trim().length()<=100?v.trim():null;
    }
}

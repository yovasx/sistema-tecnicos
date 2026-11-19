package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.shared.mail.ServicioEmail;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import java.nio.charset.StandardCharsets;

@Service
public class RecuperacionService {
    private final JdbcTemplate jdbc;
    private final ServicioEmail correo;
    private final PasswordEncoder claves;
    private final SecureRandom azar = new SecureRandom();
    public RecuperacionService(JdbcTemplate jdbc, ServicioEmail correo, PasswordEncoder claves) {
        this.jdbc=jdbc; this.correo=correo; this.claves=claves;
    }
    @Transactional
    public UUID solicitar(String email) {
        UUID id=UUID.randomUUID();
        String codigo="%06d".formatted(azar.nextInt(1000000));
        boolean enviar=Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT identity.solicitar_recuperacion(?,?,?)",Boolean.class,email,id,codigo));
        if (enviar) {
            try { correo.enviarRecuperacion(email.trim(),codigo); }
            catch (RuntimeException ex) {
                // No revelar si había cuenta, ni afirmar entrega: el texto público es condicional.
                // Se invalida este desafío; se conserva el límite para evitar abuso del SMTP caído.
                jdbc.update("UPDATE identity.recuperaciones SET consumido=TRUE WHERE id=?",id);
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Entrega de recuperación no disponible.");
            }
        }
        return id;
    }
    @Transactional(noRollbackFor=ApiException.class)
    public String confirmar(UUID id,String codigo) {
        byte[] bytes=new byte[32]; azar.nextBytes(bytes);
        String permiso=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT identity.confirmar_recuperacion(?,?,?)",Boolean.class,id,codigo,permiso))) throw invalido();
        return permiso;
    }
    @Transactional
    public void restablecer(UUID id,String permiso,String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length>72)
            throw new ApiException(HttpStatus.BAD_REQUEST,"DATOS_INVALIDOS","La contraseña no puede superar 72 bytes.");
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT identity.restablecer_password(?,?,?)",Boolean.class,id,permiso,claves.encode(password)))) throw invalido();
    }
    private ApiException invalido() {
        return new ApiException(HttpStatus.BAD_REQUEST,"RECUPERACION_INVALIDA",
            "El código o la autorización no es válido, venció o ya fue usado. Solicitá un código nuevo.");
    }
}

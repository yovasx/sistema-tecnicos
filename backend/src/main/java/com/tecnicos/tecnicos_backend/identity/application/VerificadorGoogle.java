package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import java.util.*;

/** Solo tokens firmados por Google para clientes OAuth permitidos por el servidor. */
@Component
public class VerificadorGoogle {
    private final Set<String> audiencias;
    private final NimbusJwtDecoder decoder;
    @org.springframework.beans.factory.annotation.Autowired
    public VerificadorGoogle(@Value("${app.google.client-ids:}") String ids) {
        this(ids,NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build());
    }
    VerificadorGoogle(String ids,NimbusJwtDecoder decoder) {
        audiencias=new HashSet<>(Arrays.asList(ids.split("\\s*,\\s*")));
        audiencias.removeIf(String::isBlank);
        this.decoder=decoder;
        decoder.setJwtValidator(JwtValidators.createDefault());
    }
    public boolean habilitado() { return !audiencias.isEmpty(); }
    public Jwt verificar(String token,String nonce) {
        if (!habilitado()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"GOOGLE_NO_CONFIGURADO",
            "El acceso con Google todavía no está configurado.");
        try {
            Jwt jwt=decoder.decode(token);
            String issuer=jwt.getClaimAsString("iss");
            String email=jwt.getClaimAsString("email");
            if (!Set.of("accounts.google.com","https://accounts.google.com").contains(issuer)
                || jwt.getAudience().stream().noneMatch(audiencias::contains)
                || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))
                || !Objects.equals(nonce,jwt.getClaimAsString("nonce"))
                || jwt.getExpiresAt()==null || jwt.getSubject()==null || jwt.getSubject().isBlank()
                || email==null || email.length()>150 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw new IllegalArgumentException();
            return jwt;
        } catch (RuntimeException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,"GOOGLE_INVALIDO","No pudimos verificar el acceso con Google. Intentá de nuevo.");
        }
    }
}

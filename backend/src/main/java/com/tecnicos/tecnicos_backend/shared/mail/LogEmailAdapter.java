package com.tecnicos.tecnicos_backend.shared.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adaptador de desarrollo: el código va al log del backend.
 *
 * <p>Siempre activo para que la app arranque sin SMTP. Cuando haya proveedor
 * real, su adaptador se marca {@code @Primary} y este queda solo como fallback
 * de log; la API no cambia.</p>
 */
@Component
public class LogEmailAdapter implements ServicioEmail {

    private static final Logger log = LoggerFactory.getLogger(LogEmailAdapter.class);

    @Override
    public void enviarCodigo(String destinatario, String codigo) {
        log.info("[DEV] Código OTP para {}: {}", destinatario, codigo);
    }
}

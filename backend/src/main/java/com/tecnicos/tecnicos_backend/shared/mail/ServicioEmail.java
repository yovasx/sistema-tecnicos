package com.tecnicos.tecnicos_backend.shared.mail;

/**
 * Puerto de envío de email.
 *
 * <p>SMTP en producción y Mailpit en desarrollo; el código nunca se expone.</p>
 */
public interface ServicioEmail {
    void enviarCodigo(String destinatario, String codigo);
}

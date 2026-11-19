package com.tecnicos.tecnicos_backend.shared.mail;

/**
 * Puerto de envío de email.
 *
 * <p>SMTP en producción y Mailpit en desarrollo; el código nunca se expone.</p>
 */
public interface ServicioEmail {
    void enviarRecuperacion(String destinatario, String codigo);
    void enviarCodigo(String destinatario, String codigo);
    void enviarInvitacion(String destinatario, String permiso);
}

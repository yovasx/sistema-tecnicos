package com.tecnicos.tecnicos_backend.shared.mail;

/**
 * Puerto de envío de email.
 *
 * <p>En desarrollo el adaptador solo logra el código: no hay SMTP en el
 * compose. Cuando haya proveedor se implementa acá y la API no cambia.</p>
 */
public interface ServicioEmail {
    void enviarCodigo(String destinatario, String codigo);
}

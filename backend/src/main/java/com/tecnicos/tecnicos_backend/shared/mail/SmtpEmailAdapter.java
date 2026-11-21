package com.tecnicos.tecnicos_backend.shared.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** SMTP real; en desarrollo se entrega en Mailpit, nunca en logs ni en la API. */
@Component
public class SmtpEmailAdapter implements ServicioEmail {
    private final JavaMailSender correo;
    private final String remitente;

    public SmtpEmailAdapter(JavaMailSender correo,
                            @Value("${app.mail.remitente}") String remitente) {
        this.correo = correo;
        this.remitente = remitente;
    }

    @Override
    public void enviarRecuperacion(String destinatario, String codigo) {
        var mensaje = new SimpleMailMessage();
        mensaje.setFrom(remitente);
        mensaje.setTo(destinatario);
        mensaje.setSubject("Recupera tu contraseña de Fixly");
        mensaje.setText("Tu código para recuperar el acceso a Fixly es: " + codigo
            + "\nVence en 10 minutos y admite 5 intentos. No lo compartas."
            + "\nSi no solicitaste cambiar tu contraseña, ignora este mensaje.");
        correo.send(mensaje);
    }

    @Override
    public void enviarInvitacion(String destinatario, String permiso) {
        var mensaje = new SimpleMailMessage();
        mensaje.setFrom(remitente);
        mensaje.setTo(destinatario);
        mensaje.setSubject("Tu invitación a Fixly");
        mensaje.setText("La administración te invitó a Fixly. Si reconoces esta invitación, "
            + "abre la página de bienvenida de Fixly y selecciona Activar cuenta invitada. "
            + "Ingresa este correo y el siguiente código de activación:\n\n" + permiso
            + "\n\nVence en 24 horas y se puede usar una sola vez. Elegirás tu propia contraseña. "
            + "No compartas este código. Si no esperabas esta invitación, ignora este mensaje.");
        correo.send(mensaje);
    }

    @Override
    public void enviarCodigo(String destinatario, String codigo) {
        var mensaje = new SimpleMailMessage();
        mensaje.setFrom(remitente);
        mensaje.setTo(destinatario);
        mensaje.setSubject("Tu código de verificación de Fixly");
        mensaje.setText("Tu código es: " + codigo
                + "\nVence en 10 minutos. No lo compartas con nadie."
                + "\nSi no solicitaste este código, ignora este mensaje.");
        correo.send(mensaje);
    }
}

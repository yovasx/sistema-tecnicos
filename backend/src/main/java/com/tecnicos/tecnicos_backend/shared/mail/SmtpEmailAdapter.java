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
    public void enviarCodigo(String destinatario, String codigo) {
        var mensaje = new SimpleMailMessage();
        mensaje.setFrom(remitente);
        mensaje.setTo(destinatario);
        mensaje.setSubject("Tu código de verificación de Fixly");
        mensaje.setText("Tu código es: " + codigo
                + "\nVence en 10 minutos. No lo compartas con nadie."
                + "\nSi no solicitaste este código, ignorá este mensaje.");
        correo.send(mensaje);
    }
}

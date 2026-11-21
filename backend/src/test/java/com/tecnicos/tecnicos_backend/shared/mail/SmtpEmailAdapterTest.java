package com.tecnicos.tecnicos_backend.shared.mail;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SmtpEmailAdapterTest {
    @Test void correos_de_recuperacion_invitacion_y_codigo_usan_lenguaje_neutral() {
        var emisor=mock(JavaMailSender.class);
        var servicio=new SmtpEmailAdapter(emisor,"no-responder@prueba.bo");
        servicio.enviarRecuperacion("destino@prueba.bo","000000");
        servicio.enviarInvitacion("destino@prueba.bo","permiso-de-prueba");
        servicio.enviarCodigo("destino@prueba.bo","111111");
        var mensajes=ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(emisor,times(3)).send(mensajes.capture());
        assertThat(mensajes.getAllValues().getFirst().getSubject()).isEqualTo("Recupera tu contraseña de Fixly");
        assertThat(mensajes.getAllValues().get(1).getText()).contains("Si reconoces", "selecciona Activar cuenta invitada", "Ingresa este correo");
        for (var m:mensajes.getAllValues()) {
            assertThat(m.getText()).contains("ignora este mensaje").doesNotContain("ignorá", "Ingresá", "elegí", "reconocés", "abrí");
        }
    }
}

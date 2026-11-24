package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.*;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FotoPerfilServiceTest {
    JdbcTemplate jdbc;
    AlmacenArchivos almacen;
    FotoPerfilService servicio;
    static final String NUEVA="/perfiles/12345678-1234-1234-1234-123456789012.jpg";
    @BeforeEach void preparar() {
        jdbc=mock(JdbcTemplate.class); almacen=mock(AlmacenArchivos.class);
        servicio=new FotoPerfilService(jdbc,mock(AuditoriaContexto.class),almacen);
        TransactionSynchronizationManager.initSynchronization();
    }
    @AfterEach void limpiar() { TransactionSynchronizationManager.clearSynchronization(); }
    MockMultipartFile imagen() throws Exception {
        var bytes=new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(800,600,BufferedImage.TYPE_INT_RGB),"png",bytes);
        return new MockMultipartFile("archivo","foto.png","image/png",bytes.toByteArray());
    }
    @Test void un_error_sql_limpia_el_archivo_nuevo_despues_del_rollback() throws Exception {
        when(almacen.guardar(eq("foto.jpg"),any())).thenReturn(NUEVA);
        when(jdbc.queryForObject(anyString(),eq(String.class),eq(2L),eq(NUEVA))).thenThrow(new IllegalStateException());
        assertThatThrownBy(()->servicio.guardar(2,imagen())).isInstanceOf(IllegalStateException.class);
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verify(almacen).eliminar(NUEVA);
    }
    @Test void normaliza_y_solo_retira_la_anterior_tras_commit() throws Exception {
        String anterior="/perfiles/87654321-1234-1234-1234-123456789012.jpg";
        when(almacen.guardar(eq("foto.jpg"),any())).thenAnswer(i-> {
            BufferedImage img=ImageIO.read((java.io.InputStream)i.getArgument(1));
            assertThat(img.getWidth()).isEqualTo(512);
            assertThat(img.getHeight()).isEqualTo(512);
            return NUEVA;
        });
        when(jdbc.queryForObject(anyString(),eq(String.class),eq(2L),eq(NUEVA))).thenReturn(anterior);
        assertThat(servicio.guardar(2,imagen())).startsWith("/api/avatares/");
        verify(almacen,never()).eliminar(any());
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        verify(almacen).eliminar(anterior);
        verify(almacen,never()).eliminar(NUEVA);
    }
}

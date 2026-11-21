package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.io.ByteArrayInputStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AvatarControllerUnitTest {
    static final String ARCHIVO="12345678-1234-1234-1234-123456789012.jpg";
    @Test void conocer_el_uuid_de_un_documento_privado_no_lo_publica() throws Exception {
        var jdbc=mock(JdbcTemplate.class);
        var almacen=mock(AlmacenArchivos.class);
        when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq("/perfiles/"+ARCHIVO))).thenReturn(false);
        var controlador=new AvatarController(almacen,jdbc);
        assertThatThrownBy(()->controlador.ver(ARCHIVO)).isInstanceOf(ApiException.class);
        verifyNoInteractions(almacen);
    }
    @Test void sirve_solo_foto_vigente_sin_cache() throws Exception {
        var jdbc=mock(JdbcTemplate.class);
        var almacen=mock(AlmacenArchivos.class);
        when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq("/perfiles/"+ARCHIVO))).thenReturn(true);
        when(almacen.abrir("/perfiles/"+ARCHIVO)).thenReturn(new ByteArrayInputStream(new byte[]{1}));
        var respuesta=new AvatarController(almacen,jdbc).ver(ARCHIVO);
        assertThat(respuesta.getStatusCode().value()).isEqualTo(200);
        assertThat(respuesta.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(respuesta.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
    }
    @Test void rechaza_rutas_y_documentos_pdf_antes_de_leer_el_almacen() {
        var jdbc=mock(JdbcTemplate.class);
        var almacen=mock(AlmacenArchivos.class);
        var controlador=new AvatarController(almacen,jdbc);
        for(String ruta:new String[]{"../../secreto",ARCHIVO.replace(".jpg",".pdf"),"foto.jpg"})
            assertThatThrownBy(()->controlador.ver(ruta)).isInstanceOf(ApiException.class);
        verifyNoInteractions(jdbc,almacen);
    }
}

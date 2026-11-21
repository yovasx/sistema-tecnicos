package com.tecnicos.tecnicos_backend.identity.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class FotoPerfilControllerTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    static final String CLIENTE="maria.quispe@ejemplo.bo";

    String login(String email) throws Exception {
        var r=mvc.perform(post("/api/auth/login").contentType("application/json")
            .content("{\"email\":\""+email+"\",\"password\":\"Fixly2026!\"}"))
            .andExpect(status().isOk()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),"$.token");
    }

    static byte[] imagen(int ancho,int alto,String formato) throws Exception {
        var img=new BufferedImage(ancho,alto,BufferedImage.TYPE_INT_RGB);
        Graphics2D g=img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0,0,ancho,alto);
        g.dispose();
        var salida=new ByteArrayOutputStream();
        ImageIO.write(img,formato,salida);
        return salida.toByteArray();
    }

    MockMultipartFile archivo(String nombre,String tipo,byte[] contenido) {
        return new MockMultipartFile("archivo",nombre,tipo,contenido);
    }

    @Test void sube_normaliza_y_expone_sin_tocar_la_revision() throws Exception {
        String token=login(CLIENTE);
        long revision=jdbc.queryForObject("SELECT revision_admin FROM identity.usuarios WHERE email=?",
            Long.class,CLIENTE);
        MvcResult r=mvc.perform(multipart("/api/perfil/foto")
                .file(archivo("perfil.jpg","image/jpeg",imagen(900,600,"jpg")))
                .header("Authorization","Bearer "+token))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store"))
            .andExpect(jsonPath("$.fotoUrl").value(startsWith("/api/avatares/")))
            .andReturn();
        String url=JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8),"$.fotoUrl");
        // La foto no participa de la edición con revisión: no invalida formularios.
        assertThat(jdbc.queryForObject("SELECT revision_admin FROM identity.usuarios WHERE email=?",
            Long.class,CLIENTE)).isEqualTo(revision);
        // La lectura pública no exige token, pero no se cachea para poder retirarla.
        mvc.perform(get(url)).andExpect(status().isOk())
            .andExpect(header().string("Content-Type","image/jpeg"))
            .andExpect(header().string("Cache-Control","no-store"));
        assertThat(jdbc.queryForObject("SELECT foto_perfil_url FROM identity.usuarios WHERE email=?",
            String.class,CLIENTE)).startsWith("/perfiles/");
    }

    @Test void reemplaza_la_foto_y_quita_sin_dejar_url() throws Exception {
        String token=login(CLIENTE);
        mvc.perform(multipart("/api/perfil/foto")
                .file(archivo("uno.jpg","image/jpeg",imagen(300,300,"jpg")))
                .header("Authorization","Bearer "+token))
            .andExpect(status().isOk());
        mvc.perform(multipart("/api/perfil/foto")
                .file(archivo("dos.png","image/png",imagen(200,400,"png")))
                .header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.fotoUrl").value(startsWith("/api/avatares/")));
        mvc.perform(delete("/api/perfil/foto").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.fotoUrl").isEmpty());
        assertThat(jdbc.queryForObject("SELECT foto_perfil_url FROM identity.usuarios WHERE email=?",
            String.class,CLIENTE)).isNull();
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM identity.auditoria_perfil
            WHERE usuario_id=(SELECT id FROM identity.usuarios WHERE email=?) AND accion='foto'
            """,Integer.class,CLIENTE)).isEqualTo(3);
    }

    @Test void rechaza_archivos_que_no_son_imagen() throws Exception {
        String token=login(CLIENTE);
        mvc.perform(multipart("/api/perfil/foto")
                .file(archivo("doc.pdf","application/pdf","%PDF-1.7".getBytes(StandardCharsets.US_ASCII)))
                .header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("FOTO_INVALIDA"));
        mvc.perform(multipart("/api/perfil/foto")
                .file(archivo("falsa.jpg","image/jpeg","no es una imagen".getBytes(StandardCharsets.UTF_8)))
                .header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("FOTO_INVALIDA"));
    }

    @Test void rechaza_imagen_mayor_a_dos_megabytes() throws Exception {
        String token=login(CLIENTE);
        byte[] grande=new byte[2*1024*1024+1];
        mvc.perform(multipart("/api/perfil/foto")
                .file(archivo("grande.jpg","image/jpeg",grande))
                .header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.codigo").value("FOTO_INVALIDA"));
    }

    @Test void la_foto_publica_no_expone_rutas_arbitrarias() throws Exception {
        mvc.perform(get("/api/avatares/no-existe.jpg")).andExpect(status().isNotFound());
        mvc.perform(get("/api/avatares/00000000-0000-0000-0000-000000000000.jpg"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.codigo").value("FOTO_NO_ENCONTRADA"));
    }

    @Test void anonimo_no_cambia_la_foto() throws Exception {
        mvc.perform(multipart("/api/perfil/foto")
            .file(archivo("x.jpg","image/jpeg",imagen(10,10,"jpg")))).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/perfil/foto")).andExpect(status().isUnauthorized());
    }
}

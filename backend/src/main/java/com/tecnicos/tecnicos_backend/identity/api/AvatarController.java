package com.tecnicos.tecnicos_backend.identity.api;

import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.nio.file.NoSuchFileException;

/**
 * Lectura pública de la foto de perfil.
 *
 * <p>La URL es un UUID v4 y cada subida genera uno nuevo. Solo sirve la foto
 * vigente de una cuenta activa. No se cachea para permitir retirarla; nunca
 * se publica el CI ni el nombre original del archivo.</p>
 */
@RestController
@RequestMapping("/api/avatares")
public class AvatarController {

    private static final String PATRON = "[a-f0-9-]{36}\\.(png|jpg|jpeg)";

    private final AlmacenArchivos almacen;
    private final JdbcTemplate jdbc;

    public AvatarController(AlmacenArchivos almacen, JdbcTemplate jdbc) {
        this.almacen = almacen;
        this.jdbc = jdbc;
    }

    @GetMapping("/{archivo}")
    public ResponseEntity<InputStreamResource> ver(@PathVariable String archivo) throws IOException {
        if (!archivo.matches(PATRON)) throw noEncontrada();
        // Compartir almacén no convierte documentos/evidencias en avatares.
        if (!Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM identity.usuarios
                WHERE foto_perfil_url=? AND activo AND eliminado_en IS NULL)
            """, Boolean.class, "/perfiles/" + archivo))) throw noEncontrada();
        try {
            return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(archivo.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG)
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    ContentDisposition.inline().filename(archivo).build().toString())
                .body(new InputStreamResource(almacen.abrir("/perfiles/" + archivo)));
        } catch (NoSuchFileException ex) {
            throw noEncontrada();
        }
    }

    private static ApiException noEncontrada() {
        return new ApiException(HttpStatus.NOT_FOUND, "FOTO_NO_ENCONTRADA", "La foto no está disponible.");
    }
}

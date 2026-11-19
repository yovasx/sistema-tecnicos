package com.tecnicos.tecnicos_backend.shared.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.Locale;

/**
 * Almacenamiento en disco local. El nombre del archivo es UUID, así que el
 * original nunca viaja al cliente: la URL es un opaco de servidor.
 */
@Component
public class AlmacenArchivosDisco implements AlmacenArchivos {

    private final Path raiz;

    public AlmacenArchivosDisco(@Value("${app.uploads.dir:./uploads}") String dir) {
        this.raiz = Path.of(dir, "perfiles").toAbsolutePath().normalize();
    }

    @Override
    public String guardar(String nombreOriginal, InputStream contenido) throws IOException {
        String extension = extensionDe(nombreOriginal);
        String nombre = UUID.randomUUID() + extension;
        Path destino = raiz.resolve(nombre);

        Files.createDirectories(destino.getParent());
        try (contenido) {
            Files.copy(contenido, destino);
        } catch (IOException e) {
            Files.deleteIfExists(destino);
            throw e;
        }
        return "/perfiles/" + nombre;
    }

    @Override
    public String tipoMime(String url) {
        String nombre = url.substring(url.lastIndexOf('/') + 1);
        String extension = extensionDe(nombre);
        return switch (extension.toLowerCase()) {
            case ".png" -> "image/png";
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".pdf" -> "application/pdf";
            default -> "application/octet-stream";
        };
    }

    @Override
    public InputStream abrir(String url) throws IOException {
        if (url == null || !url.startsWith("/perfiles/")) throw new IOException("Ruta inválida.");
        // La URL siempre empieza con /perfiles/: no hay forma de salir del directorio.
        Path destino = raiz.resolve(url.substring("/perfiles/".length())).normalize();
        if (!destino.startsWith(raiz)) {
            throw new IOException("Ruta inválida.");
        }
        return Files.newInputStream(destino);
    }

    @Override
    public void eliminar(String url) {
        if (url == null || !url.matches("/perfiles/[a-f0-9-]{36}\\.(png|jpg|jpeg|pdf)")) return;
        try {
            Path destino = raiz.resolve(url.substring("/perfiles/".length())).normalize();
            if (destino.startsWith(raiz)) Files.deleteIfExists(destino);
        } catch (IOException e) {
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("No se pudo limpiar un documento temporal.");
        }
    }

    private static String extensionDe(String nombre) {
        int punto = nombre.lastIndexOf('.');
        if (punto < 0) {
            return "";
        }
        String ext = nombre.substring(punto).toLowerCase(Locale.ROOT);
        return ext.length() <= 5 ? ext : "";
    }
}

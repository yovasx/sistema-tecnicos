package com.tecnicos.tecnicos_backend.identity.application;

import com.tecnicos.tecnicos_backend.shared.persistence.AuditoriaContexto;
import com.tecnicos.tecnicos_backend.shared.storage.AlmacenArchivos;
import com.tecnicos.tecnicos_backend.shared.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;

/**
 * Foto de perfil del cliente.
 *
 * <p>Se normaliza siempre a un cuadrado JPEG de 512 px: el cliente nunca
 * decide el tamaño real del archivo ni la ruta donde se guarda. La columna
 * conserva la ruta privada del almacén y la API devuelve un opaco público.</p>
 */
@Service
public class FotoPerfilService {

    private static final int LADO = 512;
    private static final long MAXIMO = 2L * 1024 * 1024;
    private static final byte[] FIRMA_PNG = {(byte) 137, 80, 78, 71, 13, 10, 26, 10};

    private final JdbcTemplate jdbc;
    private final AuditoriaContexto auditoria;
    private final AlmacenArchivos almacen;

    public FotoPerfilService(JdbcTemplate jdbc, AuditoriaContexto auditoria, AlmacenArchivos almacen) {
        this.jdbc = jdbc;
        this.auditoria = auditoria;
        this.almacen = almacen;
    }

    /** Devuelve la URL pública de la foto recién guardada. */
    @Transactional(rollbackFor = IOException.class)
    public String guardar(long id, MultipartFile archivo) throws IOException {
        auditoria.aplicarEnTransaccion();
        validar(archivo);
        byte[] normalizada = normalizar(archivo.getBytes());
        String url = almacen.guardar("foto.jpg", new ByteArrayInputStream(normalizada));
        final String[] anterior = {null};
        // El archivo anterior solo se borra si la transacción confirma; si falla,
        // se descarta el nuevo para no dejar huérfanos.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int estado) {
                if (estado == STATUS_COMMITTED) {
                    if (anterior[0] != null) almacen.eliminar(anterior[0]);
                } else {
                    almacen.eliminar(url);
                }
            }
        });
        anterior[0] = cambiar(id, url);
        return PerfilService.urlPublica(url);
    }

    /** Quita la foto; el archivo se elimina después del commit. */
    @Transactional
    public void quitar(long id) {
        auditoria.aplicarEnTransaccion();
        String anterior = cambiar(id, null);
        if (anterior == null) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int estado) {
                if (estado == STATUS_COMMITTED) almacen.eliminar(anterior);
            }
        });
    }

    private String cambiar(long id, String url) {
        return jdbc.queryForObject("SELECT identity.cambiar_foto_perfil(?::bigint,?::text)", String.class, id, url);
    }

    private static void validar(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty() || archivo.getSize() > MAXIMO) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOTO_INVALIDA",
                "Selecciona una imagen JPG o PNG de hasta 2 MB.");
        }
        byte[] cabecera;
        try (var entrada = archivo.getInputStream()) {
            cabecera = entrada.readNBytes(8);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOTO_INVALIDA",
                "No se pudo leer la imagen. Intenta de nuevo.");
        }
        boolean png = cabecera.length >= 8 && Arrays.equals(cabecera, FIRMA_PNG);
        boolean jpg = cabecera.length >= 3 && cabecera[0] == (byte) 255
            && cabecera[1] == (byte) 216 && cabecera[2] == (byte) 255;
        if (!png && !jpg) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOTO_INVALIDA",
                "Selecciona una imagen JPG o PNG válida.");
        }
    }

    /**
     * Recorte cuadrado centrado y salida JPEG. El fondo blanco evita el negro
     * que aparece al convertir PNG con transparencia.
     */
    private static byte[] normalizar(byte[] original) throws IOException {
        BufferedImage imagen;
        // Consultar dimensiones antes de decodificar: evita imágenes bomba.
        try (var entrada = ImageIO.createImageInputStream(new ByteArrayInputStream(original))) {
            var lectores = ImageIO.getImageReaders(entrada);
            if (!lectores.hasNext()) throw new ApiException(HttpStatus.BAD_REQUEST, "FOTO_INVALIDA",
                "Selecciona una imagen JPG o PNG válida.");
            var lector = lectores.next();
            try {
                lector.setInput(entrada);
                if ((long) lector.getWidth(0) * lector.getHeight(0) > 16000000)
                    throw new ApiException(HttpStatus.BAD_REQUEST, "FOTO_INVALIDA",
                        "La imagen no puede superar los 16 megapíxeles.");
                imagen = lector.read(0);
            } finally { lector.dispose(); }
        } catch (javax.imageio.IIOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOTO_INVALIDA", "No se pudo leer la imagen.");
        }
        if (imagen == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOTO_INVALIDA",
                "Selecciona una imagen JPG o PNG válida.");
        }
        int lado = Math.min(imagen.getWidth(), imagen.getHeight());
        int x = (imagen.getWidth() - lado) / 2;
        int y = (imagen.getHeight() - lado) / 2;
        int destino = Math.min(LADO, lado);
        BufferedImage salida = new BufferedImage(destino, destino, BufferedImage.TYPE_INT_RGB);
        Graphics2D grafico = salida.createGraphics();
        try {
            grafico.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            grafico.setRenderingHint(RenderingHints.KEY_RENDERING,
                RenderingHints.VALUE_RENDER_QUALITY);
            grafico.setColor(Color.WHITE);
            grafico.fillRect(0, 0, destino, destino);
            grafico.drawImage(imagen.getSubimage(x, y, lado, lado), 0, 0, destino, destino, null);
        } finally {
            grafico.dispose();
        }
        var salidaBytes = new ByteArrayOutputStream();
        ImageIO.write(salida, "jpg", salidaBytes);
        return salidaBytes.toByteArray();
    }
}

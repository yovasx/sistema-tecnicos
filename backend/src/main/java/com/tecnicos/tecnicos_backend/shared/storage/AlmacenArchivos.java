package com.tecnicos.tecnicos_backend.shared.storage;

import java.io.IOException;
import java.io.InputStream;

/**
 * Puerto de almacenamiento de archivos del expediente.
 *
 * <p>Nada público: las URLs que expone la API son internas y solo se sirven
 * autenticadas. En desarrollo es disco local; en producción se enchufa S3
 * detrás del mismo puerto.</p>
 */
public interface AlmacenArchivos {

    /** Guarda el archivo y devuelve la URL relativa para leerlo después. */
    String guardar(String nombreOriginal, InputStream contenido) throws IOException;

    /** Tipo MIME por extensión, para servir el archivo con el header correcto. */
    String tipoMime(String url);

    /** Contenido del archivo; lanza IOException si no existe. */
    java.io.InputStream abrir(String url) throws IOException;
    /** Limpieza compensatoria si una transacción no confirma el documento. */
    void eliminar(String url);
}

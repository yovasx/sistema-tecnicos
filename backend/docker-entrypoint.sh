#!/bin/sh
set -eu

# Compatibilidad con documentos_data creado por las imágenes anteriores (root).
# Solo ajusta el volumen de documentos; Java siempre se ejecuta sin root.
if [ "$(id -u)" = "0" ]; then
    mkdir -p /app/uploads
    chown -R fixly:fixly /app/uploads
    exec gosu fixly:fixly java -jar /app/app.jar "$@"
fi

exec java -jar /app/app.jar "$@"

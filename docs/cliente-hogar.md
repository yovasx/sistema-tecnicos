# Cliente hogar: V18, V19 y V25

## Alcance

- **V18**: foto de perfil normalizada, direcciones con baja lógica y auditoría,
  índices de reputación del cliente y calificaciones privadas.
- **V19**: ubicación del técnico por orden, tickets WebSocket de un uso y funciones de retención.
- **V25**: ubicación opcional del cliente para el técnico asignado, solo con consentimiento y sin historial.
- Las migraciones aplicadas no se reescriben. No recrear la base ni borrar volúmenes.
- `Mi cuenta` permite agregar/quitar foto, administrar hasta 10 direcciones y
  consultar el resumen de servicios y las últimas 20 valoraciones recibidas.
- El wizard copia una dirección guardada al borrador. La orden conserva texto y
  coordenadas: editar la libreta no modifica una solicitud enviada.
- `Mis servicios` permite calificar una orden finalizada una sola vez (1–5,
  comentario opcional de hasta 1000 caracteres).
- Las recomendaciones previas al envío son consejos de preparación de la
  solicitud, no recomendaciones de técnicos ni una promesa de precio/ETA.

La tabla de preferencias de V18 queda reservada para la siguiente fase. No se
presentan controles de push que aparenten activar un servicio aún inexistente.
Tampoco se publican comentarios de forma anónima: faltan el flujo y la operación
de moderación pública. No hay chat, llamada ni reasignación ficticios.

## API

Todas las rutas propias exigen JWT activo y usan `Cache-Control: no-store`.

| Ruta | Uso |
|---|---|
| `POST /api/perfil/foto` | Multipart `archivo`, JPG/PNG ≤2 MB y ≤16 megapíxeles; recorte central JPEG ≤512 px |
| `DELETE /api/perfil/foto` | Quita la foto y devuelve el perfil actualizado |
| `GET /api/avatares/{archivo}` | Lectura pública solo de una foto actualmente referenciada por una cuenta activa |
| `GET/POST /api/perfil/direcciones` | Listar/crear propias |
| `PUT/DELETE /api/perfil/direcciones/{id}` | Editar/quitar propias; DELETE es baja lógica |
| `GET /api/perfil/reputacion` | Promedio, cantidad, resumen de servicios y valoraciones propias |
| `POST /api/ordenes/{id}/calificacion` | Cliente califica a su técnico |
| `POST /api/tecnicos/ordenes/{id}/calificacion` | Técnico califica a su cliente |
| `GET /api/ordenes/{id}/seguimiento` | Snapshot autorizado; también disponible como consulta puntual si falla el socket |
| `POST /api/ordenes/{id}/seguimiento/ticket` | Ticket efímero para la orden propia en `en_camino` |
| `POST /api/ordenes/{id}/seguimiento/gps` | Cliente inicia compartir ubicación para su orden `en_camino`, con `{plataforma}` |
| `POST /api/ordenes/seguimiento/ubicacion` | Cliente envía `{sesion, latitud, longitud, precision, capturadoEn}` durante una sesión consentida |
| `DELETE /api/ordenes/seguimiento/gps/{sesion}` | Cliente detiene su sesión; elimina inmediatamente su posición actual |
| `POST /api/tecnicos/servicios/{id}/gps` | Técnico aprobado inicia sesión GPS para la orden `en_camino` |
| `POST /api/tecnicos/ubicacion` | Técnico envía `{sesion, latitud, longitud, precision, capturadoEn}` durante su sesión |

Guardar dirección recibe `{etiqueta, referencia, latitud, longitud, predeterminada}`.
Calificar recibe `{puntaje, comentario}`. Dueño y destinatario nunca se eligen
desde el cuerpo. Una lectura de avatar no permite abrir un documento privado
aunque se conozca su UUID. Retirar la foto revoca su enlace; no hay caché pública.
El cambio de foto no invalida formularios de datos personales abiertos.

## WebSocket y privacidad

1. Pedir ticket con el JWT por HTTP.
2. Abrir `/api/ws/seguimiento` (`wss` con HTTPS).
3. Enviar como primer mensaje `{"ticket":"..."}`; **no** usar query string ni
   enviar el JWT al iframe del mapa.
4. Se recibe el snapshot completo de seguimiento aproximadamente cada 3 s.

Se persiste solo SHA-256 del ticket (256 bits aleatorios), con vencimiento a
60 s y consumo atómico de un uso. Su hash vincula además versión de sesión y
expiración original del JWT. El socket revalida usuario activo, versión, JWT y
pertenencia a la orden en cada actualización. Cierra al dejar `en_camino`.
Los canales no aceptan publicaciones ni cambios de orden del cliente.

El envío se basa en snapshots confirmados de PostgreSQL, **no en RabbitMQ**.
Esto permite reconectar y consultar desde distintas instancias sin perder
eventos ni mantener estados privados divergentes. La carga de consultas crece
con las conexiones activas; hay límites locales de 500 canales y 3 por cuenta.
Antes de escalar, medir carga y distribuir eventos con un broker si hace falta.
No equivale todavía a una arquitectura de alta concurrencia validada.

El cliente cierra el canal al ocultar la pestaña, cambiar de sección o pasar
la app a segundo plano; reconecta con un ticket nuevo y espera progresiva.
La posición queda marcada como desactualizada al perder conexión. Hay consulta
manual de respaldo, no polling continuo del cliente.

Los reportes se aceptan como máximo cada 3 s. Se crea la partición mensual del
historial bajo un lock, y se conservan posiciones históricas durante 30 días.
Cada minuto se purgan tickets vencidos y posiciones ligadas a órdenes que ya
no están en camino; nunca se sirven esas posiciones durante esa espera.
Las posiciones antiguas sin `orden_id` no se eliminan con esta limpieza. La ubicación del cliente no crea historial: se elimina al detener el consentimiento o al salir la orden de `en_camino`. La sesión del cliente usa un lease renovado con cada reporte y vence en 30 segundos si deja de enviar; la posición vencida no se entrega aunque el proceso de limpieza todavía no haya corrido.

La ETA solo se muestra para una posición reciente (≤30 s): distancia geodésica
×1,35 a 20 km/h. **No es una ruta vial, ni considera tráfico**, ni confirma llegada.
La tarjeta distingue última posición, datos ausentes y pérdida de señal.

## Leaflet y simulador

Mapa web en iframe aislado; nativo en WebView. Ambos usan Leaflet 1.9.4 fijado
con SRI y el mismo HTML sin credenciales. Solo se carga al abrirlo explícitamente.
Elegir un punto tiene alternativa manual/GPS puntual.

Durante `en_camino`, el cliente puede autorizar explícitamente el envío de su
ubicación precisa en primer plano. Se detiene al cerrar el mapa, cambiar de
sección, ocultar/minimizar la app o terminar el trayecto. Solo el técnico
asignado puede recibirla por el WebSocket de esa orden. El cliente no recibe su
propia coordenada desde la API; su marcador local solo se dibuja mientras la
señal sigue reciente. El técnico también puede consultar el mapa en vivo y ve
ese marcador únicamente mientras el consentimiento esté vigente. El GPS del
cliente no se ejecuta en segundo plano ni se registra en historial, URL, logs o
storage.

- `EXPO_PUBLIC_MAPA_TILES_URL`: plantilla pública del proveedor.
- `EXPO_PUBLIC_MAPA_ATRIBUCION`: atribución del proveedor.
- Sin configuración, se usa OSM para desarrollo/demo. Revisar políticas,
  cuotas y proveedor antes de producción. Los tiles requieren Internet.
- En Docker se pasan como argumentos de build; cambiar valores requiere
  reconstruir la web. Nunca colocar secretos en estas variables.
- `Probar ruta simulada (desarrollo)` existe solo con `__DEV__`. No genera
  técnicos, no escribe ubicaciones, no cambia estados y no aparece en la
  exportación de producción.
- El emisor real y el ciclo operativo del técnico están descritos en
  `docs/operacion-tecnica.md` (V20–V22): sesiones GPS por orden, aceptación,
  diagnóstico, cotización, reparación y finalización. Validar el segundo plano
  nativo en un development build actualizado y con dispositivo real.

## Verificación

```powershell
# Raíz; Docker Desktop debe estar ejecutándose
docker compose up -d postgres

# backend/
.\gradlew.bat test

# Opcional: repetir el roundtrip WebSocket contra Nginx ya actualizado
$env:SEGUIMIENTO_PRUEBA_URL="http://localhost:9081"
.\gradlew.bat test --tests "*SeguimientoWebSocketIntegrationTest" --rerun-tasks
Remove-Item Env:SEGUIMIENTO_PRUEBA_URL

# mobile/
npx tsc --noEmit
npm run verificar:lenguaje
npx expo export --platform web
```

Pruebas nuevas: direcciones, fotos, reputación y seguimiento contra PostgreSQL;
unitarias para no publicar documentos privados como fotos, compensación de
archivos al fallar SQL y autorización/cierre del WebSocket.

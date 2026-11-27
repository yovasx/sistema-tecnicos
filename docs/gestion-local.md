# Gestión local de servicios técnicos

Este documento describe el alcance implementado en V26–V30: **una sola empresa
prestadora** que atiende pedidos de clientes particulares y empresariales, con
personal técnico incorporado por coordinación. No es un marketplace abierto: no
hay técnicos independientes compitiendo públicamente, ni pagos electrónicos,
billetera, retiros, comisiones de intermediación, reseñas públicas, chatbot de
diagnóstico ni penalizaciones automáticas.

El esquema histórico de esos módulos se conserva (migraciones aplicadas no se
editan) pero no se ofrece en la navegación ni se usa en los flujos nuevos.

## Roles y permisos

| Capacidad | Cliente | Técnico asignado | Coordinación (admin) |
|---|---|---|---|
| Crear solicitud, adjuntar evidencia inicial | Sí | — | — |
| Cancelar antes de asignar | Sí | — | Sí, con motivo |
| Ver atención y su historial | Sí, solo la propia | Sí, solo la asignada | Sí, todas |
| Generar código de llegada | Sí, en `en_camino` | — | — |
| Confirmar llegada con código | — | Sí | Solo `llegada_justificada` justificada |
| Pausar / reanudar | — | Sí | Reprogramar con fecha |
| Cotizar y responder cotización | Responde | Propone | No cotiza |
| Registrar entrega con evidencia | — | Sí | — |
| Dar conformidad | Sí | — | Solo `cerrar_entrega` con causal |
| Abrir reclamo | Sí | Sí | — |
| Equipos y sucursales | Sí, propios | — | Consulta en la ficha de orden |
| Costos autorizados | Sí, propios | — | Reportes CSV |
| Panel de coordinación e indicadores | — | — | Sí |

El administrador existente representa al coordinador de la empresa. Una cuenta
empresarial representa a **un responsable autorizado**; no hay jerarquía
multiusuario ni multitenencia SaaS.

El alta técnica pública está cerrada (`403 ALTA_POR_INVITACION`), también para el
registro con Google de propósito `tecnico`. El personal entra por invitación
administrativa (`POST /api/admin/usuarios/invitaciones`), que crea el perfil
técnico en borrador; después completa el expediente y coordinación lo aprueba.

## Estados

Los estados principales no cambiaron:

```
solicitado → en_camino → en_diagnostico → en_reparacion → finalizado
                                                       ↘ cancelado
```

Pausa, incidencia, entrega y conformidad son **dimensiones de
`orders.atenciones`**, no estados nuevos del enum:

- `pausa_motivo` / `reanudar_en`: atención detenida por repuestos u otra causa.
- `incidencia`: texto de la situación que requiere coordinación.
- `entregado_en` + `conformidad` (`pendiente`, `conforme`, `observado`,
  `resuelto_coordinacion`) + `respuesta_cliente`.
- `llegada_verificada_en`: llegada confirmada con código o por coordinación.

La orden permanece `en_reparacion` hasta que el cliente da conformidad o
coordinación resuelve el cierre. Entregar no finaliza ni cobra nada.

Cada acción operativa exige la `revision` leída: si otra persona actuó antes, la
respuesta es `409` y hay que refrescar. No se permite saltar etapas ni repetir una
acción con efectos distintos.

## Asignación explicable

1. La solicitud entra en `orders.busquedas_servicio` con 15 minutos de plazo.
2. Cada 15 s, `DespachoProgramado` ejecuta `orders.mantener_ofertas()` bajo un
   advisory lock; también expira ofertas vencidas. No depende de que alguien abra
   una pantalla.
3. Elegibilidad del técnico: cuenta activa y no eliminada, perfil aprobado,
   disponibilidad activa, especialidad de la categoría, cobertura vigente que
   contiene el punto y ninguna otra orden abierta.
4. Orden entre elegibles: cobertura, disponibilidad, ausencia de otra atención,
   distancia **solo si la posición tiene menos de 30 s**, reputación, mayor tiempo
   sin asignación y, por último, ID. No se exige activar GPS.
5. Se envían hasta 6 ofertas por ronda, con 2 minutos de vigencia, hasta 18
   destinatarios distintos por búsqueda. Un técnico que ya recibió la orden no la
   recibe otra vez en el mismo intento.
6. La aceptación se serializa por técnico y por orden, y revalida en PostgreSQL
   disponibilidad, cobertura, especialidad, estado de la búsqueda y ausencia de
   otra orden abierta. Dos técnicos no pueden ganar la misma orden y un técnico no
   puede quedarse con dos.
7. Si no hay asignación al vencer el plazo (o se agotan los 18 destinatarios), la
   búsqueda pasa a `sin_disponibilidad`. El cliente puede pedir hasta **3
   intentos**; coordinación también puede intervenir. No se inventa un técnico,
   precio ni ETA.

`GET /api/admin/operacion/{id}/candidatos` explica la evaluación actual (no una
reconstrucción histórica) con cobertura, disponibilidad, carga, distancia
geodésica reciente y reputación.

## Llegada verificable

- El cliente genera un código de **ocho cifras** solo en `en_camino`, desde la
  pantalla de atención: `POST /api/servicios/{id}/atencion/codigo`.
- El servidor usa aleatoriedad criptográfica (`gen_random_bytes`) y guarda solo
  SHA-256. El código no viaja en JWT, URL, logs ni almacenamiento del dispositivo.
- Vigencia 10 minutos, 5 intentos, espera de 60 s entre emisiones y máximo 5
  códigos por día (fecha de Bolivia).
- El técnico confirma con `POST /api/servicios/{id}/atencion/llegada` y
  `{codigo}`. Al acertar se borra el hash, la orden pasa a `en_diagnostico` y se
  registra el evento. Los intentos fallidos persisten aunque la respuesta sea
  `400`.
- `POST /api/tecnicos/servicios/{id}/llegada` sin código responde `409`: ya no se
  puede omitir la verificación.
- Coordinación puede usar `llegada_justificada` con motivo cuando no fue posible
  el código; queda auditado.

## Excepciones y continuidad

Acciones del técnico (`POST /api/servicios/{id}/atencion/incidencia`):

- `pausar`: motivo 10–1000 caracteres y fecha de continuación futura dentro de 30
  días. La pausa cierra las sesiones GPS de la orden y retira las posiciones.
- `reanudar`: limpia la pausa; el estado principal no cambia.
- `cliente_ausente`: solo en `en_camino`; registra la incidencia, no cobra.
- `solicitar_cancelacion` / `solicitar_coordinacion`: dejan la incidencia visible
  en el panel.

Acciones de coordinación (`POST /api/admin/operacion/{id}/resolver`):

- `cancelar`: cierra la orden, libera al técnico y cierra ofertas/búsqueda.
- `llegada_justificada`: solo en `en_camino`.
- `reprogramar`: pausa con fecha futura dentro de 30 días.
- `cerrar_entrega`: solo si hay entrega `observado` o pendiente por más de 48 h.

No hay reasignación silenciosa: para cambiar de técnico se cancela y se crea otra
solicitud, conservando la orden, sus mensajes y su historial. Tampoco hay cargos
automáticos por visita fallida, cancelación o diagnóstico: una cotización
autorizada es una autorización de trabajo, no un pago ni una factura fiscal.

## Entrega y conformidad

`POST /api/servicios/{id}/atencion/entrega` (multipart, solo técnico asignado):

- Requiere `en_reparacion`, sin pausa, con cotización aceptada y ninguna enviada
  pendiente.
- `trabajo`: 20–2000 caracteres. `mantenimiento` opcional: fecha futura dentro de
  dos años.
- `evidencia`: JPG, PNG o PDF hasta 8 MB, guardada como archivo privado
  `/perfiles/<uuid>.<ext>`. Si la transacción falla, el archivo se elimina.
- Deja `conformidad='pendiente'` y la orden sigue `en_reparacion`.

`POST /api/servicios/{id}/atencion/conformidad` (solo cliente dueño):

- `{revision, conforme, comentario}` con comentario de 10–1000 caracteres.
- `conforme=true` finaliza la orden. `false` deja `observado` y una incidencia
  para coordinación.
- `GET /api/servicios/{id}/atencion/evidencia` descarga autenticada, `no-store`,
  `attachment` y `nosniff`, solo para participantes o administración.

## Reclamos

- `POST /api/disputas` con `{orden, motivo}`; cualquier participante de la orden.
- `GET /api/disputas?pagina=N&orden=ID` muestra los reclamos propios (o de una
  orden concreta). Coordinación los revisa en «Disputas» con la API existente.
- Un reclamo no implica culpabilidad, reembolso ni sanción automática. No hay
  reseñas públicas ni moderación ficticia.

## Equipos y sucursales

- `GET/POST /api/equipos`, `PUT /api/equipos/{id}`,
  `GET /api/equipos/{id}/historial`.
- `GET/POST /api/sucursales`, `PUT /api/sucursales/{id}`. Solo cuentas
  empresariales pueden tener sucursales.
- Hasta 100 equipos y 20 sucursales por cuenta. La baja es lógica
  (`activo/activa=false`) y conserva el historial; no se borra físicamente.
- La edición usa `revision` (409 si cambió) y queda auditada.
- Al crear la solicitud se puede vincular un equipo. La orden guarda un snapshot
  del nombre y de la sucursal: renombrar después no altera órdenes pasadas.
- El historial muestra las últimas 100 atenciones con trabajo, conformidad y
  próximo mantenimiento. No se puede consultar ni vincular un equipo ajeno.
- Las direcciones se siguen eligiendo por solicitud; el equipo no cambia el punto
  de atención.

## Costos autorizados

`GET /api/ordenes/facturacion?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&sucursal=ID`

- Suma la **última cotización aceptada de cada orden** del cliente. No es deuda,
  saldo pagado ni factura fiscal.
- Filtros opcionales por fecha de autorización (`respondida_en`, días de Bolivia
  inclusivos, máximo 366 días) y por sucursal del snapshot del equipo.
- Hasta 100 líneas; el total considera todas las órdenes del filtro.

## Indicadores de coordinación

`GET /api/admin/operacion` devuelve la cohorte de órdenes creadas en los últimos
30 días (horario de Bolivia) y hasta 50 atenciones pendientes:

| Indicador | Fórmula |
|---|---|
| Creadas | órdenes con `creado_en` en la cohorte |
| Asignadas | creadas con `asignado_en` no nulo |
| Sin asignación | creadas, hoy `solicitado` y sin técnico |
| Finalizadas / Canceladas | por estado actual |
| Minutos de asignación | promedio de `asignado_en - creado_en` |
| Minutos de llegada | promedio de `llegada_en - asignado_en` con ambas fechas |
| Cotizaciones respondidas | aceptadas + rechazadas de órdenes de la cohorte |
| Cotizaciones aceptadas | aceptadas de órdenes de la cohorte |
| Reclamos sobre cerradas | órdenes distintas de la cohorte con reclamo y estado cerrado |
| Cerradas | finalizadas + canceladas |

Los promedios muestran «Sin muestra» si no hay casos. No son SLA contractuales ni
ingresos. La cohorte mide órdenes creadas en el período; las cotizaciones se
cuentan por la orden, no por la fecha de respuesta.

## API nueva o modificada

| Método y ruta | Uso |
|---|---|
| `GET /api/servicios/{id}/atencion` | snapshot de atención y últimos 50 eventos |
| `POST /api/servicios/{id}/atencion/codigo` | código de llegada (cliente) |
| `POST /api/servicios/{id}/atencion/llegada` | confirmar encuentro (técnico) |
| `POST /api/servicios/{id}/atencion/incidencia` | pausa, reanudación, avisos |
| `POST /api/servicios/{id}/atencion/reintentar` | nuevo intento de búsqueda |
| `POST /api/servicios/{id}/atencion/entrega` | trabajo + evidencia (multipart) |
| `POST /api/servicios/{id}/atencion/conformidad` | decisión del cliente |
| `GET /api/servicios/{id}/atencion/evidencia` | descarga privada |
| `GET /api/admin/operacion` | indicadores y cola de coordinación |
| `GET /api/admin/operacion/{id}/candidatos` | asignación explicable |
| `POST /api/admin/operacion/{id}/resolver` | excepciones y cierre |
| `GET/POST /api/equipos`, `PUT /api/equipos/{id}`, `GET /api/equipos/{id}/historial` | equipos |
| `GET/POST /api/sucursales`, `PUT /api/sucursales/{id}` | sucursales |
| `GET /api/ordenes/facturacion` | costos autorizados con filtros |
| `GET /api/disputas?orden=ID` | reclamos propios de una orden |
| `POST /api/ordenes` | acepta `equipo` opcional en el multipart |

Todo lo nuevo responde `Cache-Control: no-store`; las lecturas de atención no
exponen coordenadas, contactos, códigos ni hashes.

## Migraciones

- **V26**: búsquedas, atenciones, eventos, aceptación serializada, código de
  llegada, pausas/incidencias, entrega/conformidad y resolución administrativa.
- **V27**: sucursales, equipos y snapshot por orden con auditoría.
- **V28**: orden de locks cliente/coordinador, bloqueo de cotizaciones posteriores
  a la entrega y sincronización del estado de búsqueda.
- **V29**: notificaciones de atención con el enum tipado.
- **V30**: sucursal histórica en el snapshot, validación de equipo archivado,
  cierre del GPS al pausar, bloqueo de sesiones GPS en pausa y llegada que no
  omite la pausa.

No se editan migraciones ya aplicadas: los cambios siguientes van en V31+.

## Verificación

```powershell
# Backend contra Postgres real (sin Testcontainers)
docker compose -f docker-compose.yml -f docker-compose.desarrollo.yml up -d postgres
cd backend
.\gradlew.bat test

cd ..\mobile
npx tsc --noEmit
npm run verificar:lenguaje
npm run verificar:gps
```

Suite actual: **313 pruebas en 41 suites, 0 fallos** (Postgres real).

`AtencionLocalTest` cubre alta técnica cerrada, doble aceptación, carreras entre
dos aceptaciones, disponibilidad/cobertura/vencimiento, código de llegada,
privacidad, intentos persistentes, pausa/reanudación, cierre de coordinación,
revisión obsoleta, equipos/sucursales e indicadores sin ingresos ficticios.
`SolicitudesControllerTest` verifica además que los costos autorizados suman la
última cotización aceptada en BOB y filtran por día boliviano y sucursal.

## Guion de defensa (7 minutos)

1. **Problema y alcance (1 min).** Una empresa local necesita asignar, verificar y
   cerrar servicios sin depender de la confianza informal. Mostrar la portada y
   aclarar qué no es: marketplace, pagos, billetera ni reseñas públicas.
2. **Solicitud (1 min).** Cliente particular crea una solicitud, elige equipo
   opcional y confirma el punto en el mapa. Explicar la idempotencia y que aún no
   hay precio ni técnico.
3. **Asignación (1,5 min).** Técnico disponible ve solo solicitudes compatibles y
   acepta. En coordinación, abrir «Asignación explicable» y leer por qué ese
   técnico: especialidad, zona, disponibilidad, carga y desempates. Mostrar que la
   búsqueda se agota a los 15 minutos y permite reintento.
4. **Llegada (1 min).** Cliente genera el código; el técnico lo ingresa. Mostrar
   que sin código la API responde 409 y que el hash no se devuelve.
5. **Trabajo y conformidad (1,5 min).** Técnico cotiza, el cliente autoriza,
   registra entrega con evidencia y el cliente da conformidad. Señalar que la
   orden no se finaliza sola, que no hay cobro automático y que la evidencia es
   privada.
6. **Excepción (1 min).** Pausar por repuesto y reanudar; o pedir ayuda. Mostrar
   la cola de coordinación y el cierre justificado con motivo.
7. **Cierre (1 min).** Equipos e historial, costos autorizados con filtros,
   indicadores con «Sin muestra», y límites honestos: sin pagos, sin push, GPS
   móvil pendiente de dispositivo y mapas dependientes de Internet.

## Requisitos para la laptop de la defensa

- Docker Desktop con Compose v2 y virtualización habilitada; 4 GB de RAM libres
  recomendados.
- Internet en la **primera** construcción (imágenes base y dependencias). Después,
  `docker compose up -d` reutiliza imágenes y volúmenes; si se actualiza el código,
  usar `docker compose up -d --build`.
- Puertos libres: 9081 (web), 9080 (API), 8025 (Mailpit). Si están ocupados,
  definir `WEB_PORT`, `BACKEND_PORT` y `MAILPIT_WEB_PORT` en un `.env` opcional.
- No hace falta instalar Java, Gradle, Node, npm ni PostgreSQL.
- Los mapas Leaflet/OpenStreetMap y el acceso con Google requieren Internet; el
  resto del flujo funciona en la red local.
- Para probar GPS desde un teléfono real hacen falta HTTPS o una red de confianza
  y un development build; `localhost` en la laptop no sirve como ubicación del
  teléfono. En la defensa se puede usar el navegador de escritorio o explicar la
  limitación.
- Los datos demo son de desarrollo: no usar contraseñas ni el secreto JWT por
  defecto en producción.

## Pendientes explícitos

- Pagos electrónicos, conciliación, facturación fiscal, billetera, retiros y
  comisiones de intermediación: **fuera de alcance**.
- Notificaciones push reales y correo transaccional distinto de OTP/invitaciones.
- Validación física de GPS en segundo plano en Android/iOS y prueba interactiva de
  Google con una cuenta real.
- Revisión de dependencias móviles: `npm audit` mantiene avisos en cadenas de
  herramientas de Expo; no se actualizó el SDK a ciegas.

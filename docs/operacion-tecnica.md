# Operación técnica: V20, V21 y V22

## Alcance

- **V20**: sesiones GPS ligadas a la orden y a la versión de sesión, preferencias
  del cliente con revisión y limpieza de tickets/posiciones.
- **V21**: disponibilidad auditada, aceptación real de solicitudes, llegada,
  cotizaciones idempotentes, respuesta del cliente, reparación, finalización,
  chat privado, notificaciones y liquidaciones de solo lectura.
- **V22**: cobertura revisable por administración, zonas circulares declaradas y
  comprobación puntual de pertenencia.
- Las migraciones aplicadas no se reescriben. Los cambios posteriores van en una
  migración nueva.

## Conceptos que no se mezclan

| Concepto | Fuente | Efecto |
|---|---|---|
| Especialidad | `identity.tecnico_especialidades` | Qué trabajos puede aceptar |
| Cobertura | `geo.zonas_cobertura` vigentes | Dónde puede aceptar |
| Ubicación puntual | Consulta del técnico, sin persistir | Solo informa dentro/fuera |
| Seguimiento GPS | `geo.sesiones_seguimiento` + `geo.ubicacion_actual` | Comparte el trayecto con el cliente de esa orden |

Estar dentro de la cobertura **no** vuelve disponible al técnico, no aprueba su
expediente y no inicia el GPS. Estar fuera tampoco cancela un servicio asignado.

## Cobertura revisable (V22)

- El técnico propone entre 1 y 5 zonas por punto y radio (100–50000 m enteros).
- La propuesta reemplaza **todas** las zonas vigentes solo al aprobarse; antes de
  eso la cobertura anterior sigue operando.
- Para proponer y para aprobar, el técnico debe estar activo, aprobado, fuera de
  servicio y sin órdenes abiertas. Aprobar no cambia especialidades, identidad,
  disponibilidad ni sesiones.
- Se permite una sola propuesta pendiente y hasta 20 propuestas por día.
- Revisión optimista: la propuesta usa la revisión de `geo.control_cobertura` y
  la decisión administrativa exige la revisión de la propuesta; si cambió,
  responde `409 CAMBIO_CONCURRENTE`.
- Rechazar no modifica la cobertura vigente. Retirar solo afecta una propuesta
  pendiente propia y es idempotente.
- Toda decisión queda en `geo.auditoria_cobertura` (antes/después) y notifica al
  técnico. La aprobación conserva los polígonos anteriores desactivados; no se
  borran.
- Los polígonos se generan con `ST_Buffer` sobre el centro declarado, de modo que
  la elegibilidad sigue usando `ST_Covers` sin reglas paralelas en Java.

### Comprobación de pertenencia

`POST /api/tecnicos/cobertura/comprobar` recibe una muestra puntual
(`latitud`, `longitud`, `precision`, `capturadoEn`) y responde:

| Estado | Significado |
|---|---|
| `dentro` | El punto está cubierto por al menos una zona vigente |
| `fuera` | No lo está |
| `cerca_limite` | La distancia al límite no supera la precisión declarada (mínimo 25 m) |
| `ubicacion_insuficiente` | Muestra de más de 30 s, futura o con precisión > 200 m |
| `sin_cobertura` | No hay zonas vigentes |

La consulta **no** escribe `geo.ubicacion_actual`, no abre sesiones, no cambia la
disponibilidad y no se comparte con clientes. La UI invalida el resultado a los
30 segundos y lo descarta si la revisión de cobertura cambió.

## Disponibilidad y aceptación

- `PUT /api/tecnicos/disponibilidad` exige terminar el servicio activo y tener
  especialidad y cobertura antes de estar disponible. Cada cambio se audita.
- `GET /api/tecnicos/panel` devuelve hasta 30 solicitudes compatibles por
  especialidad, cobertura y disponibilidad; no expone dirección, referencia ni
  coordenadas antes de aceptar.
- `POST /api/tecnicos/servicios/{id}/aceptar` es idempotente para la propia
  aceptación y vuelve a validar en PostgreSQL: cuenta activa, aprobación,
  especialidad, cobertura, disponibilidad y ausencia de otra orden abierta.
- La aceptación crea la oferta y usa `orders.aceptar_oferta`; no inventa precio,
  ETA ni pagos.

## Ciclo operativo

```
solicitado → en_camino → en_diagnostico → en_reparacion → finalizado
```

- `llegada`, `reparacion` y `finalizar` son acciones cerradas, no un selector
  libre de estados. Repetir la misma acción es idempotente; saltar de estado
  responde `409`.
- Iniciar reparación y finalizar exigen una cotización aceptada del técnico y
  ninguna cotización enviada pendiente.
- Finalizar **no** crea pagos ni liquidaciones.
- Cancelar sigue siendo exclusivo del cliente y solo antes de asignar técnico.

## Cotizaciones

- `POST /api/tecnicos/servicios/{id}/cotizaciones` exige clave UUID; la huella
  SHA-256 evita reutilizar la clave con otro contenido. Reintentar devuelve la
  misma cotización.
- Ítems: `visita`, `mano_obra`, `repuesto`, `desplazamiento`, `urgencia`, `otro`;
  1–20 conceptos, importes en BOB con dos decimales.
- El cliente responde con `POST /api/ordenes/{id}/cotizaciones/{cotizacion}/responder`
  (`acepta`, `motivo` opcional). Solo el cliente dueño de la orden puede hacerlo y
  la cotización debe seguir `enviada`.

## Chat y notificaciones

- `GET/POST /api/servicios/{id}/mensajes` solo para cliente y técnico de la orden.
- Envío idempotente por clave UUID, máximo 2000 caracteres y 20 mensajes cada 10 s.
- La conversación se cierra al terminar la orden. No hay llamadas, archivos ni
  moderación pública.
- Las notificaciones se crean en `notification.notificaciones`; no hay push real
  ni correo transaccional en esta fase.

## Liquidaciones

`GET /api/tecnicos/liquidaciones` es de solo lectura y muestra únicamente filas
existentes de `billing.liquidaciones`. No se simulan pagos, retiros, comisiones
fijas ni saldos.

## Privacidad

- La posición solo se publica al cliente de la orden en `en_camino`, con muestra
  de hasta 30 s y precisión de hasta 200 m.
- Detener el GPS, revocar la sesión, salir de `en_camino` o iniciar otra sesión
  retira la posición anterior.
- El WebSocket sigue el contrato de V19: ticket de un uso en el primer mensaje,
  nunca JWT en la URL.
- Las propuestas de cobertura no exponen datos de clientes y no publican zonas en
  el mapa del cliente.

## Verificación

```powershell
# Raíz; Docker Desktop debe estar ejecutándose
docker compose up -d postgres

# backend/ (requiere PostgreSQL real)
.\gradlew.bat test

# mobile/
npx tsc --noEmit
npm run verificar:lenguaje
npm run verificar:gps
```

Pruebas nuevas de V22: propuesta pendiente sin efecto, aprobación con sustitución
de zonas, auditoría y notificación, reintento idempotente, revisión obsoleta,
propuesta duplicada, propuesta con orden abierta, aprobación con técnico
disponible, retiro por otro técnico, permisos de revisión y comprobación
puntual sin escrituras de posición.

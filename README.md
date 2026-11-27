# Fixly — gestión de servicios técnicos

Sistema para que **una empresa local** reciba solicitudes de clientes
particulares y empresariales, asigne a su personal técnico, verifique la
llegada, registre el trabajo con evidencia y cierre el servicio con la
conformidad del cliente. No es un marketplace abierto ni una plataforma de
pagos.

**Fuera de alcance por ahora:** pagos electrónicos, billetera, retiros,
comisiones de intermediación, penalizaciones automáticas, reseñas públicas,
chatbot o diagnóstico con IA, notificaciones push reales y facturación fiscal.
El esquema histórico de esos módulos se conserva, pero no se ofrece en la
navegación ni se usa en los flujos nuevos.

## Estado actual

Implementado y verificable de punta a punta:

- Registro e inicio de sesión (contraseña, Google opcional y recuperación por
  correo), perfiles de cliente persona/empresa, administrador y técnico.
- Catálogo de categorías con tarifas y alta técnica por invitación.
- Solicitud de servicio idempotente con evidencia privada y seguimiento.
- Búsqueda y asignación explicable con vencimiento, reintentos y aceptación
  serializada; panel de coordinación con indicadores reales.
- Llegada con código de ocho cifras, pausas e incidencias, entrega con
  evidencia y conformidad del cliente.
- Equipos y sucursales por cliente, costos autorizados con filtros y reclamos.
- Chat privado por orden, notificaciones internas y cobertura revisable.

Detalle funcional, permisos, fórmulas y guion de defensa:
[`docs/gestion-local.md`](docs/gestion-local.md). Operación técnica y GPS:
[`docs/operacion-tecnica.md`](docs/operacion-tecnica.md) y
[`docs/cliente-hogar.md`](docs/cliente-hogar.md).

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Spring Boot 4.1.1 · Java 21 · Gradle 9.8.1 |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 · Flyway |
| Mobile / Web | Expo SDK 58 · React Native 0.88 · TypeScript |
| Infraestructura | Docker Compose (Nginx + API + PostGIS + Mailpit) |

## Arranque con Docker

Requisitos: **Docker Desktop** con Compose v2 e Internet en la primera
construcción. No hace falta instalar Java, Gradle, Node, npm ni PostgreSQL.

```powershell
docker compose up -d
docker compose ps
```

La primera ejecución compila la API con el wrapper de Gradle dentro de Java 21
y la web con `npm ci` dentro de Node 22; puede tardar varios minutos. Las
siguientes ejecuciones reutilizan imágenes y volúmenes. Tras cambiar código,
usá `docker compose up -d --build`.

| Servicio | URL |
|---|---|
| Web y backoffice | http://localhost:9081 |
| API y estado real de la base | http://localhost:9080/api/ping |
| Correos de desarrollo (Mailpit) | http://localhost:8025 |

Para esperar el arranque desde la consola:

```powershell
docker compose up -d --wait --wait-timeout 300
```

Todos los puertos se publican solo en `127.0.0.1`. Postgres no se publica por
defecto; si necesitás `psql` o `bootRun` desde el host:

```powershell
docker compose -f docker-compose.yml -f docker-compose.desarrollo.yml up -d postgres
```

RabbitMQ no es necesario para la demo. Si más adelante se usa mensajería:

```powershell
docker compose --profile mensajeria up -d
```

### Usuarios demo

Todos usan la contraseña `Fixly2026!`. Provienen de las migraciones de
desarrollo; **no son aptos para producción**.

| Rol | Correo |
|---|---|
| Administrador / coordinación | `admin@fixly.bo` |
| Cliente persona | `maria.quispe@ejemplo.bo` |
| Cliente persona | `jorge.mamani@ejemplo.bo` |
| Cliente empresa | `contacto@ferreteria-lapaz.bo` |
| Técnico aprobado | `diego.vargas@ejemplo.bo` |
| Técnico aprobado | `lucia.fernandez@ejemplo.bo` |
| Técnico aprobado | `raul.choque@ejemplo.bo` |

El alta técnica pública está cerrada (`403 ALTA_POR_INVITACION`), también con
Google. La empresa incorpora personal desde **Usuarios → Invitar** con rol
técnico; la invitación crea el perfil en borrador y el onboarding y la revisión
siguen su curso normal. Se puede desactivar ese cierre con
`EMPRESA_LOCAL=false` solo para pruebas históricas del flujo público.

### Configuración opcional

`.env` es opcional: Compose trae valores de desarrollo. Copiá `.env.example` a
`.env` para cambiar puertos, SMTP, Google o el secreto JWT. Ningún `.env` entra
en las imágenes. El ID público de Google web se inyecta al compilar; los
secretos quedan en el backend.

## Flujos principales

1. **Solicitud.** El cliente elige categoría, describe el problema, marca el
   punto y adjunta evidencia opcional. La orden nace en `solicitado`, sin
   técnico, precio ni ETA. Reintentar con la misma clave devuelve la misma
   orden.
2. **Asignación.** `orders.mantener_ofertas()` evalúa elegibilidad y ordena
   candidatos por cobertura, disponibilidad, carga, distancia reciente (solo
   con GPS de menos de 30 s), reputación y antigüedad. Se ofertan hasta 18
   técnicos distintos en 15 minutos; si nadie acepta, la solicitud queda
   `sin_disponibilidad` y el cliente puede reintentar hasta 3 veces.
   Coordinación ve la explicación de cada candidato.
3. **Llegada.** El cliente genera un código de 8 cifras (hash SHA-256, 10
   minutos, 5 intentos). El técnico lo confirma; sin código la API responde
   `409`. Coordinación puede justificar la llegada con motivo.
4. **Trabajo.** El técnico cotiza, el cliente autoriza, se registra la
   reparación y luego la **entrega** con trabajo y evidencia privada. La orden
   sigue `en_reparacion` hasta la conformidad del cliente; coordinación solo
   cierra entregas observadas o pendientes por más de 48 h, con causal.
5. **Excepciones.** Pausa por repuestos, reanudación, cliente ausente,
   solicitud de cancelación o de coordinación. No hay reasignación silenciosa:
   se cancela y se crea otra solicitud, conservando historial y mensajes.
6. **Cierre administrativo.** Equipos e historial por cliente, costos
   autorizados (última cotización aceptada en BOB, no pagos), reclamos e
   indicadores de la cohorte de 30 días.

Los estados principales son `solicitado → en_camino → en_diagnostico →
en_reparacion → finalizado` (o `cancelado`). Pausa, incidencia, entrega y
conformidad son dimensiones de `orders.atenciones`, no estados nuevos.

## API resumida

| Método y ruta | Uso |
|---|---|
| `GET /api/ping` | estado real de la API y la base |
| `POST /api/auth/{login,registro,recuperacion/*,google/*}` | acceso y alta de clientes |
| `POST /api/auth/invitaciones/aceptar` | activar una cuenta invitada |
| `GET /api/publico/categorias` | catálogo público sin comisiones |
| `POST/GET /api/ordenes`, `GET /api/ordenes/{id}` | solicitud y seguimiento propio |
| `POST /api/servicios/{id}/atencion/{codigo,llegada,incidencia,reintentar,entrega,conformidad}` | operación del servicio |
| `GET /api/servicios/{id}/atencion[/evidencia]` | snapshot y archivo privado |
| `GET /api/tecnicos/panel`, `PUT /api/tecnicos/disponibilidad` | panel técnico |
| `POST /api/tecnicos/servicios/{id}/{aceptar,reparacion}` | aceptación y reparación |
| `GET/POST /api/equipos`, `GET/POST /api/sucursales` | equipos y sucursales |
| `GET /api/ordenes/facturacion?desde&hasta&sucursal` | costos autorizados |
| `GET/POST /api/disputas` | reclamos propios |
| `GET /api/admin/operacion`, `/{id}/candidatos`, `POST /{id}/resolver` | coordinación |
| `GET /api/admin/{ordenes,usuarios,tecnicos,categorias,dashboard}` | backoffice |

Todo lo nuevo responde `Cache-Control: no-store`; los listados no transportan
direcciones, contactos ni coordenadas. Sin token, las rutas protegidas
responden `401 NO_AUTENTICADO`.

## Base de datos

Flyway es la única fuente del esquema; Hibernate valida (`ddl-auto: validate`).
La línea base es `V1__plataforma_tecnicos_v2.sql`; los cambios posteriores van
en migraciones nuevas y **nunca** se edita una aplicada.

- V2–V25: autenticación, catálogo, expediente técnico, usuarios, invitaciones,
  solicitudes, perfil, seguimiento GPS, operación y cobertura.
- V26–V30: búsqueda/atención, equipos y sucursales, consistencia, notificaciones
  tipadas e integridad operativa.

Esquemas: `identity`, `orders`, `geo`, `billing`, `chat`, `reputation`,
`admin_svc`, `notification`. Las tablas y columnas están en español y las
reglas de negocio viven en constraints, triggers y funciones PL/pgSQL.

Para recrear la base de desarrollo: `docker compose down -v` (destructivo).

## Desarrollo sin Docker

Backend (necesita Postgres vivo):

```powershell
docker compose -f docker-compose.yml -f docker-compose.desarrollo.yml up -d postgres
cd backend
.\gradlew.bat bootRun      # :8080
.\gradlew.bat test         # suite completa contra Postgres real
```

`test` levanta el contexto Spring y corre Flyway; sin base falla. No hay
Testcontainers ni H2. Si cambiás `POSTGRES_PASSWORD`, exportá
`SPRING_DATASOURCE_PASSWORD` antes de `bootRun`.

Mobile:

```powershell
cd mobile
Copy-Item .env.example .env.local
npm install
npm start                  # Metro en :9081
npx tsc --noEmit           # typecheck
npm run verificar:lenguaje
npm run verificar:gps
```

`EXPO_PUBLIC_API_URL` es obligatorio: `http://localhost:9080` en web/iOS,
`http://10.0.2.2:9080` en emulador Android e IP LAN en un teléfono físico.
No hay lint ni tests unitarios de UI.

## Verificación

```powershell
# Suite Java completa dentro de Docker, contra Postgres real
docker compose --profile pruebas run --rm pruebas

# O desde backend/ con una base viva
cd backend
.\gradlew.bat test
```

`AtencionLocalTest` cubre alta técnica cerrada, doble aceptación y carreras,
disponibilidad/cobertura/vencimiento, código de llegada, privacidad, pausas,
cierre de coordinación, revisión obsoleta, equipos/sucursales e indicadores.
`solicitudes`, autenticación, catálogo y backoffice tienen sus propias suites.

## Privacidad y seguridad

- Contraseñas con BCrypt; JWT con versión de sesión que se invalida al cambiar
  clave o desactivar la cuenta.
- Documentos y evidencias en volumen privado, descarga autenticada con
  `no-store`, `attachment` y `nosniff`; nunca URLs públicas.
- Códigos de llegada, OTP e invitaciones se guardan solo como hash y no se
  registran en logs.
- Ubicaciones: el cliente comparte GPS opcional solo durante `en_camino` y el
  técnico asignado lo ve mientras la muestra sea reciente; no hay historial ni
  coordenadas en URLs.
- Las cuentas demo, el secreto JWT de desarrollo y Mailpit son solo para
  desarrollo local. No publiques este stack en Internet sin TLS, SMTP real,
  backups y secretos propios.

## Puertos y variables

| Variable | Default | Uso |
|---|---|---|
| `WEB_PORT` | `9081` | web compilada (Nginx) |
| `BACKEND_PORT` | `9080` | API en el host |
| `MAILPIT_WEB_PORT` / `MAILPIT_SMTP_PORT` | `8025` / `1025` | correo de desarrollo |
| `POSTGRES_PORT` | `5432` | solo con `docker-compose.desarrollo.yml` |
| `EMPRESA_LOCAL` | `true` | cierra el alta técnica pública |
| `JWT_SECRET`, `JWT_ISSUER`, `JWT_TTL_MINUTES` | desarrollo | autenticación |
| `GOOGLE_CLIENT_IDS`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | vacío | Google opcional |
| `SMTP_*` | Mailpit | OTP e invitaciones |

## Estructura del repositorio

```
backend/                 API Spring Boot, Flyway y pruebas
mobile/                  app Expo / React Native (web incluida)
docker-compose.yml       arranque completo de demostración
docker-compose.desarrollo.yml  publica Postgres para desarrollo
docs/                    alcance, operación, cliente y GPS
AGENTS.md                guía para agentes/IA
```

## Git

`main` es la rama estable y protegida. Trabajá en `feature/*`, `fix/*` o
`chore/*`, abrí un PR y fusioná con squash. Commits con Conventional Commits
(`feat(orders): ...`, `fix(db): ...`, `docs: ...`). Las versiones estables se
etiquetan `vX.Y.Z` sobre `main`.

## Límites conocidos

- Pagos, conciliación, facturación fiscal, billetera, retiros y comisiones:
  fuera de alcance.
- Notificaciones push reales y correo transaccional distinto de OTP e
  invitaciones: pendientes.
- GPS en segundo plano y Google interactivo requieren un dispositivo o
  development build; no se validaron físicamente en este repositorio.
- Los mapas Leaflet/OpenStreetMap y Google necesitan Internet. La primera
  construcción Docker también.
- `npm audit` conserva avisos transitivos de herramientas de Expo; no se
  actualizó el SDK a ciegas.

## Troubleshooting

- **Puerto ocupado:** definí `WEB_PORT`, `BACKEND_PORT` o el puerto
  correspondiente en `.env`. Metro y la web Docker no comparten el 9081.
- **Cambié código y no se ve:** `docker compose up -d --build`.
- **Flyway checksum mismatch:** se editó una migración aplicada. En desarrollo
  recreá la base con `down -v`; en producción no se edita.
- **Error de Postgres en `bootRun`:** la contraseña del volumen no coincide con
  `application.yml`; exportá `SPRING_DATASOURCE_PASSWORD` o alineá el `.env`.
- **Android no conecta:** usá `http://10.0.2.2:9080`, no `localhost`.
- **Teléfono físico:** usá la IP LAN y permití el puerto en el firewall.
- **`down -v` borra datos.** No lo uses si querés conservar la base o los
  documentos.

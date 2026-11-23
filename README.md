# Sistema de Técnicos a Domicilio

Plataforma para solicitar servicios técnicos a domicilio: los clientes publican una orden, los técnicos reciben ofertas, y el administrador valida cuentas y gestiona el catálogo. Incluye base geoespacial, chat, cotizaciones versionadas, pagos, liquidaciones y reputación.

<<<<<<< HEAD
> **Versión estable local:** autenticación, recuperación, catálogo, usuarios y gestión/revisión de técnicos. Órdenes, pagos y liquidaciones siguen pendientes en la aplicación. El arranque completo está dockerizado; es un entorno de desarrollo/demo, no un despliegue público de producción.
=======
> **Estado:** autenticación, recuperación, catálogo, usuarios, gestión/revisión de técnicos y consulta administrativa de órdenes. El flujo operativo de solicitudes/asignación, pagos y liquidaciones sigue pendiente. Arranque completo dockerizado para desarrollo/demo local, no un despliegue público de producción.
>>>>>>> main

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Spring Boot 4.1.1 · Java 21 · Gradle 9.8.1 |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 · Flyway |
| Mobile / Web | Expo SDK 58 · React Native 0.88 · TypeScript |
| Infraestructura | Docker Compose |

## Arquitectura

```
┌──────────────────────┐   HTTP/JSON   ┌────────────────────┐   JPA/Flyway   ┌──────────────────────┐
│ Expo (Android/Web)   │ ────────────▶ │ Spring Boot API    │ ─────────────▶ │ PostgreSQL + PostGIS │
└──────────────────────┘               └────────────────────┘                └──────────────────────┘
```

- El backend se organizará por feature y capas (dominio, aplicación, infraestructura y presentación).
- El esquema lo controla Flyway; Hibernate solo valida (`ddl-auto: validate`).
- La app mobile separa puertos (`src/domain`) de adaptadores (`src/infrastructure`).

## Estructura del repositorio

```
.
├─ backend/                         API Spring Boot
│  ├─ src/main/java/                código Java
│  └─ src/main/resources/db/migration/
├─ mobile/                          app Expo / React Native
│  ├─ App.tsx                       entrypoint actual
│  └─ src/domain, src/infrastructure
├─ docker-compose.yml               web Nginx + API + PostGIS + RabbitMQ + Mailpit
├─ .env.example                     variables de Docker y auth
├─ AGENTS.md                        guía para agentes/IA
└─ README.md
```

## Requisitos

- **Docker Desktop** con Compose v2 (en Windows, backend WSL2).
- Internet durante la primera construcción (imágenes y dependencias).
- **Git**, para clonar.

**No necesitás Java, Gradle, Node.js, npm ni Expo instalados para usar la web.**
Node.js 22.13+ y JDK 21 solo son necesarios para desarrollo fuera de Docker.

## Puesta en marcha

### Arranque completo con un comando

```powershell
git clone https://github.com/yovasx/sistema-tecnicos.git
cd sistema-tecnicos
docker compose up -d
```

La primera ejecución compila la API con el wrapper de Gradle dentro de Java 21
y la web con `npm ci` dentro de Node 22. Nginx sirve la exportación web; no se usa
Metro. No hay que copiar `.env`, compilar JARs ni instalar herramientas locales.
Puede tardar varios minutos; se requiere acceso a los registros y repositorios.

```powershell
docker compose ps
docker compose logs -f backend
```

Abrí **http://localhost:9081** cuando `web` y `backend` estén saludables.
Para esperar desde la consola: `docker compose up -d --wait --wait-timeout 240`.
Flyway aplica las migraciones automáticamente. Nginx envía `/api` al backend
por la red privada: el bundle no apunta al `localhost` del navegador.

- Web y panel administrativo: **http://localhost:9081**
- API/estado con consulta real a la base: **http://localhost:9080/api/ping**
- Correos de prueba Mailpit: **http://localhost:8025**
- Administrador demo: `admin@fixly.bo` / `Fixly2026!`

Todos los puertos publicados se limitan a `127.0.0.1`. Las contraseñas demo,
el secreto JWT de desarrollo y los usuarios sembrados **no son aptos para
producción**. Los correos van a Mailpit, no a Gmail. Google permanece deshabilitado
sin IDs OAuth válidos.

### Configuración opcional y actualización

Podés copiar `.env.example` a `.env` para cambiar puertos, SMTP o Google.
No se copia ningún `.env` al construir imágenes. El ID público de Google web se
inyecta como argumento de compilación; los secretos permanecen en el backend.

Después de actualizar código, también alcanza con `docker compose up -d`.
Backend y web usan `pull_policy: build`: verifican la construcción en cada
arranque y reutilizan capas sin cambios, evitando ejecutar una imagen antigua.
Base, documentos y RabbitMQ usan volúmenes persistentes; `docker compose down`
no los borra. **No usar `down -v` con datos que quieras conservar.**
Al arrancar, el backend adapta los permisos del volumen de documentos de las
imágenes antiguas y luego ejecuta Java como usuario sin privilegios.

Si antes ejecutabas Metro en 9081, detenelo o configurá `WEB_PORT` diferente.
Si tenés una base creada con otra contraseña, conservá su `.env`: cambiar una
variable no cambia la contraseña guardada dentro del volumen existente.

### Verificación reproducible (sin Gradle local)

```powershell
docker compose build --no-cache backend web
docker compose up -d --wait --wait-timeout 240
docker compose --profile pruebas run --build --rm pruebas
```

La última instrucción corre la suite Java en un contenedor contra Postgres real.
Usala en un entorno de pruebas, no con datos de producción. La construcción web
incluye TypeScript. GitHub Actions repite construcción, arranque limpio y tests.
El wrapper verifica el SHA-256 oficial de Gradle, reintenta descargas y tolera
conexiones lentas. Los errores de compilación ya no se ocultan.

### Desarrollo nativo o con Metro (opcional, fuera de Docker)

```powershell
cd mobile
Copy-Item .env.example .env.local
npm install
npm start
```

Editá `mobile/.env.local` según dónde corras la app:

| Entorno | `EXPO_PUBLIC_API_URL` |
|---|---|
| Web / simulador iOS | `http://localhost:9080` |
| Emulador Android | `http://10.0.2.2:9080` |
| Teléfono físico | `http://<IP-LAN-de-tu-PC>:9080` |

## Puertos

| Servicio | Puerto |
|---|---|
| PostgreSQL | `5432` |
| RabbitMQ (AMQP) | `5672` |
| RabbitMQ (consola) | `15672` — http://localhost:15672 |
| Backend en Docker | `9080` (host) → `8080` (contenedor) |
| Backend con `bootRun` | `8080` |
| Web Docker / Expo Metro (alternativos) | `9081` |
| Mailpit (bandeja / SMTP) | `8025` / `1025` |

## Variables de entorno

### Raíz (`.env`)

| Variable | Default | Uso |
|---|---|---|
| `POSTGRES_DB` | `tecnicos_db` | nombre de la base |
| `POSTGRES_USER` | `tecnicos_user` | usuario de Postgres |
| `POSTGRES_PASSWORD` | `password` | contraseña de Postgres |
| `POSTGRES_PORT` | `5432` | puerto publicado de Postgres |
| `BACKEND_PORT` | `9080` | puerto publicado del backend |
| `WEB_PORT` | `9081` | web compilada servida por Nginx |
| `JWT_SECRET` | — | secreto HMAC en Base64 (mínimo 32 bytes); vacío usa el de desarrollo |
| `JWT_ISSUER` | `https://api.fixly.bo` | emisor del token; debe ser URL http(s) |
| `JWT_TTL_MINUTES` | `30` | vigencia del access token |
| `RABBITMQ_USER` | `tecnicos` | usuario de RabbitMQ |
| `RABBITMQ_PASSWORD` | `tecnicos` | contraseña de RabbitMQ |
| `RABBITMQ_PORT` | `5672` | puerto AMQP publicado |
| `RABBITMQ_MANAGEMENT_PORT` | `15672` | consola web de RabbitMQ |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:9081` | orígenes permitidos para Expo web |

`JWT_*` lo consume el backend. El admin demo procede de la migración V2, no de
variables `ADMIN_*`. RabbitMQ todavía no tiene publishers ni consumers;
Compose espera a que esté saludable antes de iniciar el backend.

### Mobile (`mobile/.env.local`)

| Variable | Uso |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL base de la API; no tiene fallback |

Las variables `EXPO_PUBLIC_*` se inyectan al compilar el bundle: si las cambiás, reiniciá Metro.

### 4. Teléfono físico: red local y firewall

Para que el teléfono llegue al backend, Windows tiene que permitir el tráfico entrante:

```powershell
# Verificá la IP de tu PC en la red local
ipconfig | Select-String "IPv4"

# Abrí los puertos (PowerShell como administrador)
New-NetFirewallRule -DisplayName "Fixly backend 9080" -Direction Inbound -Protocol TCP -LocalPort 9080 -Action Allow
New-NetFirewallRule -DisplayName "Fixly Expo 9081"    -Direction Inbound -Protocol TCP -LocalPort 9081 -Action Allow
```

Y probalo desde el teléfono:

```powershell
Invoke-WebRequest http://<IP-LAN-de-tu-PC>:9080/api/ping
```

Si responde `"status": "ok"` y `"base": "ok"`, el teléfono ya ve al backend.

### 5. Verificar el arranque limpio

Esto es lo que hay que poder repetir desde cero, sin pasos manuales:

```powershell
# 1. Recrear la base desde cero (BORRA los datos de desarrollo)
docker compose down -v
docker compose up -d postgres

# 2. Arrancar el backend; Flyway aplica V1 y V2 solo
cd backend
.\gradlew.bat bootRun

# 3. Healthcheck real
Invoke-WebRequest http://localhost:8080/api/ping   # 200, "base": "ok"

# 4. Suite completa contra la misma base que usa producción
.\gradlew.bat test
```

`docker compose up -d postgres` **solo** levanta la base: sirve para desarrollar con `bootRun` en local. `docker compose up -d --build` levanta base y backend en contenedor.

## Comandos

### Backend

```powershell
cd backend
.\gradlew.bat bootRun       # :8080; necesita Postgres arriba
.\gradlew.bat test          # suite completa; necesita Postgres arriba
.\gradlew.bat test --tests "com.tecnicos.tecnicos_backend.TecnicosBackendApplicationTests"
```

En Linux/macOS usá `./gradlew`. El proyecto no tiene lint ni formatter configurados.

### Mobile

```powershell
cd mobile
npm start                   # Expo/Metro en :9081
npm run android             # emulador/dispositivo Android
npm run web                 # web en :9081
npx tsc --noEmit            # typecheck
npx expo install <paquete>  # agregar dependencias nativas compatibles con el SDK
```

No uses `npm install <paquete>` para librerías nativas: `expo install` resuelve la versión correcta para SDK 58.

### Docker

```powershell
docker compose up -d --build     # desde la raíz
docker compose logs -f backend
docker compose down              # conserva el volumen
docker compose down -v           # BORRA la base y todos los datos
```

## Base de datos

La v2 es la línea base: `backend/src/main/resources/db/migration/V1__plataforma_tecnicos_v2.sql`.

Esquemas:

| Esquema | Contenido |
|---|---|
| `identity` | usuarios, perfiles de técnico, especialidades |
| `orders` | categorías, órdenes, ofertas, transiciones |
| `geo` | zonas, ubicación actual, historial particionado |
| `billing` | tarifas, cotizaciones, pagos, comisiones, liquidaciones |
| `chat` | conversaciones y mensajes |
| `reputation` | calificaciones e índices |
| `admin_svc` | disputas y evidencias |
| `notification` | notificaciones y dispositivos push |

Reglas:

- **No edites `V1`** una vez aplicada. Los cambios van en `V2__...sql`, `V3__...sql`, etc.
- Hibernate usa `ddl-auto: validate`: si una entidad no coincide con el SQL, la app no arranca.
- Para recrear la base de desarrollo: `docker compose down -v` y volver a levantar. Es destructivo.

### Migración V2: seeds de La Paz

`V2__seeds_la_paz.sql` carga datos de desarrollo **idempotentes**: categorías, tarifas, comisión del 15%, usuarios, perfiles de técnico y zonas de cobertura. Cada bloque verifica si los datos ya existen, así que correrla dos veces no duplica nada.

Categorías: **Plomería**, **Electricidad**, **Climatización**.
Zonas: **Sopocachi**, **Miraflores**, **Calacoto (Zona Sur)**.

Usuarios de prueba (todos con la misma contraseña):

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@fixly.bo` | `Fixly2026!` |
| Cliente | `maria.quispe@ejemplo.bo` | `Fixly2026!` |
| Cliente | `jorge.mamani@ejemplo.bo` | `Fixly2026!` |
| Técnico (Plomería, Electricidad) | `diego.vargas@ejemplo.bo` | `Fixly2026!` |
| Técnico (Electricidad, Climatización) | `lucia.fernandez@ejemplo.bo` | `Fixly2026!` |
| Técnico (Climatización, Plomería) | `raul.choque@ejemplo.bo` | `Fixly2026!` |
| Cliente empresa (Ferretería La Paz S.R.L., NIT `1234567021`) | `contacto@ferreteria-lapaz.bo` | `Fixly2026!` |

Los técnicos nacen `aprobado` y `disponible` para que el matching encuentre candidatos desde el primer día. **Nunca sembrar esta migración en producción.**

### Migración V3: perfil de cliente empresa

`V3__perfil_cliente_empresa.sql` agrega `identity.tipo_cliente` (`persona` | `empresa`) y las columnas `razon_social` y `nit`.

- El **rol sigue siendo `cliente`**: las reglas de autorización y las funciones de la base no cambian. El perfil solo define qué casos de uso ve la app.
- Solo un `cliente` puede ser `empresa`; técnicos y administradores son siempre `persona`.
- Una empresa exige razón social y NIT (`CHECK`), y el NIT es único entre cuentas activas.
- Hoy una empresa es **una sola cuenta**. Varios usuarios por empresa (tablas `empresas` + `empresa_miembros`) queda para un sprint posterior.

Verificar el historial:

```powershell
docker compose exec postgres psql -U tecnicos_user -d tecnicos_db `
  -c "select version, description, success from flyway_schema_history order by installed_rank;"
```

## API (roadmap)

| Método | Endpoint | Estado |
|---|---|---|
| GET | `/api/ping` | ✅ implementado; devuelve 200 con estado real de la base, o 503 si no responde |
| POST | `/api/auth/login` | ✅ implementado; email + contraseña → JWT HS256 |
| POST | `/api/auth/registro` | ✅ implementado; alta pública de cliente (persona/empresa) → JWT; el `rol` siempre es `cliente` |
| POST | `/api/auth/recuperacion/solicitar` | ✅ respuesta genérica + `solicitudId`; código por email si corresponde |
| POST | `/api/auth/recuperacion/confirmar` | ✅ `{solicitudId,codigo}` → permiso temporal de un uso |
| POST | `/api/auth/recuperacion/restablecer` | ✅ `{solicitudId,permiso,password}` → cambia clave y revoca sesiones anteriores |
| POST | `/api/auth/google/desafio` | ✅ nonce temporal, solo si Google está configurado |
| POST | `/api/auth/google` | ✅ `{idToken,nonce,nombre?,apellido?}` → cliente persona; identidad verificada por backend |
| POST | `/api/auth/google/vincular` | ✅ requiere sesión, contraseña actual, Google con el mismo correo y consentimiento explícito |
| POST | `/api/tecnicos/registro` | ✅ alta técnica separada → sesión, sin habilitación operativa |
| POST | `/api/tecnicos/verificacion/email/solicitar` | Compatibilidad de V5; opcional, no se usa en el onboarding actual |
| POST | `/api/tecnicos/verificacion/email/confirmar` | Compatibilidad de V5; no autoriza recuperar contraseña |
| GET | `/api/tecnicos/expediente` | ✅ expediente privado y progreso reanudable |
| PUT | `/api/tecnicos/expediente/datos-personales`, `/especialidades`, `/zonas` | ✅ guarda pasos (rutas completas bajo `/api/tecnicos/expediente`) |
| POST | `/api/tecnicos/expediente/documentos` | ✅ multipart: `ci_frente`, `ci_dorso`, `certificaciones`; admite reemplazos parciales |
| POST | `/api/tecnicos/expediente/enviar` | ✅ envío y reenvío tras corregir observaciones |
| GET | `/api/tecnicos/expediente/documentos/{nombre}` | ✅ dueño/admin, descarga privada sin cache |
| GET | `/api/admin/tecnicos/expedientes` | ✅ cola por `estado` (en_revision/observado/aprobado/rechazado), excluye borradores |
| GET | `/api/admin/tecnicos/expedientes/{id}` | ✅ detalle privado para revisión |
| POST | `/api/admin/tecnicos/expedientes/{id}/observar`, `/aprobar`, `/rechazar` | ✅ decisiones documentales con auditoría en BD |
| GET | `/api/auth/me` | ✅ implementado; perfil fresco desde la base (incluye `tipoCliente`, `razonSocial`, `nit`) |
| GET | `/api/publico/categorias` | ✅ implementado; catálogo público: nombre, descripción y tarifa vigente por categoría (sin comisión) |
| GET | `/api/admin/resumen` | ✅ implementado; conteos reales (usuarios por rol, técnicos pendientes/aprobados, categorías activas) |
| GET | `/api/admin/usuarios` | ✅ implementado; listado con perfil visible, sin hash |
| GET | `/api/admin/categorias` | ✅ categoría + tarifa + comisión vigentes y sus fechas |
| GET | `/api/admin/tecnicos/pendientes` | ✅ implementado; perfiles con validación pendiente (vacío con los seeds) |
| POST | `/api/admin/categorias` | ✅ crea categoría, tarifa y comisión de forma atómica |
| PUT | `/api/admin/categorias/{id}` | ✅ edita categoría, precios y estado; sin borrado físico |
| GET | `/api/admin/usuarios/pagina` | ✅ búsqueda, filtros de rol/perfil/estado y paginación de servidor |
| GET/PUT | `/api/admin/usuarios/{id}` | ✅ ficha y edición auditada con revisión optimista |
| PATCH | `/api/admin/usuarios/{id}/estado` | ✅ activar/desactivar con motivo y revocación de sesiones |
| GET | `/api/admin/usuarios/{id}/historial` | ✅ historial paginado de cambios administrativos |
| POST | `/api/admin/usuarios/invitaciones` | ✅ invitación por SMTP con reautenticación administrativa |
| POST | `/api/auth/invitaciones/aceptar` | ✅ activación pública de un solo uso; no entrega sesión automática |
| GET | `/api/admin/tecnicos` | ✅ directorio paginado; filtros de cuenta, expediente, disponibilidad y especialidad |
| GET | `/api/admin/tecnicos/{id}` | ✅ ficha privada: cuenta, expediente, especialidades y cobertura |
| GET | `/api/admin/tecnicos/{id}/revisiones` | ✅ historial paginado de decisiones documentales |
<<<<<<< HEAD
=======
| GET | `/api/admin/ordenes` | ✅ consulta paginada; búsqueda por ID/nombres, estado, categoría, asignación y fechas |
| GET | `/api/admin/ordenes/{id}` | ✅ ficha privada del servicio, personas, ubicación y fechas |
| GET | `/api/admin/ordenes/{id}/historial` | ✅ transiciones registradas paginadas; sin reconstrucción de eventos |
>>>>>>> main

El resto de la API exige `Authorization: Bearer <token>`. Sin token (o con uno inválido) responde **401 `NO_AUTENTICADO`**. Son públicas GET `/api/ping` y `/api/publico/**`, POST `/api/auth/login`, `/api/auth/registro`, `/api/tecnicos/registro`, `/api/auth/recuperacion/*`, `/api/auth/google`, `/api/auth/google/desafio` y `/api/auth/invitaciones/aceptar`. **Vincular Google exige sesión**.

### Gestión administrativa de usuarios (W48)

En web ≥1024 px, **Personas → Usuarios** permite buscar por nombre, correo, ID o
razón social y filtrar por rol, perfil y estado. El listado solicita páginas
al servidor (20 filas por defecto, máximo 100); `GET /usuarios` se conserva
para consumidores existentes. Las cuentas eliminadas no se muestran.

- **Ver ficha:** información, método de acceso y auditoría; sin hashes, códigos,
  CI ni documentos privados. Sección e ID se conservan en el fragmento de la URL
  para reabrir la ficha tras F5; no se guardan formularios ni datos personales.
- **Editar:** nombre, apellido, teléfono y datos de empresa. No cambia correo,
  rol, método de acceso ni validación técnica. La identidad de técnicos ya
  aprobados requiere revisión documental y no se edita aquí.
- **Estado:** desactivar/reactivar requiere motivo. No permite autodesactivarse,
  dejar la plataforma sin administradores activos ni desactivar cuentas con
  órdenes en curso. Ambas acciones incrementan `version_sesion`; reactivar
  no devuelve validez a tokens anteriores. Toda ruta protegida rechaza cuentas
  inactivas/eliminadas antes de ejecutar el controlador.
- **Concurrencia:** PUT/PATCH requieren la `revision` del detalle. Si otro
  proceso cambió la cuenta, devuelve 409 `CAMBIO_CONCURRENTE`; recargar requiere
  confirmar el descarte del borrador. V12 instala el contador y las funciones
  transaccionales con actor `app.usuario_id`.
- **Historial:** `admin_svc.auditoria_usuarios` registra actor, motivo y cambios
  antes/después de los campos permitidos; no reconstruye eventos previos a V12.
- **Sin borrado físico:** la baja operativa es desactivar; no hay DELETE.

#### Crear una cuenta por invitación

1. Como admin, elegí **Invitar usuario**, completá datos y rol y confirmá
   con tu contraseña actual. Invitar a otro administrador requiere además una
   confirmación explícita en la interfaz.
2. El servidor envía un permiso aleatorio por SMTP. En desarrollo se lee en
   Mailpit (`http://localhost:8025`), no en la respuesta de la API.
3. El destinatario entra a **Ingresar → Tengo una invitación**, pega el correo
   y el código recibido y elige una contraseña de al menos 10 caracteres
   (máximo 72 bytes). Luego inicia sesión normalmente.
4. La cuenta solo se crea al aceptar. Los técnicos comienzan pendientes y
   deben completar el onboarding; la invitación no los aprueba.

V13 guarda solo el hash del permiso, válido por 24 horas y de un solo uso.
Límite de 20 invitaciones por administrador en 24 horas y 60 segundos entre
envíos al mismo correo. Una nueva invitación invalida la anterior; un fallo SMTP
revierte la operación y no crea cuenta. El remitente debe seguir siendo un
administrador activo al aceptar. No se fusionan cuentas existentes por email.
Mailpit no entrega a casillas externas; producción requiere SMTP real.

<<<<<<< HEAD
=======
### Órdenes administrativas (W46/W47)

En **Operación → Órdenes**, listado y ficha de **solo lectura**. No crea
solicitudes, asigna técnicos, fuerza estados ni cancela órdenes. No inventa
importes, SLA, métricas ni posiciones en vivo. Si no hay solicitudes, muestra
un estado vacío real; no agrega órdenes de ejemplo a la base del usuario.

- **Filtros:** ID exacto o nombre de cliente/técnico, estado, categoría
  (incluidas las inactivas), con/sin técnico y fechas. Completalos y pulsá
  **Aplicar filtros** o Enter en la búsqueda. **Actualizar órdenes** vuelve a
  consultar los criterios ya aplicados. Páginas de 20, orden por creación e ID.
- **Fechas:** `desde`/`hasta` son días ISO `AAAA-MM-DD` en `America/La_Paz`;
  ambos días incluidos. API compara inicio inclusivo y comienzo del día
  posterior a `hasta` exclusivo. El detalle/historial también usa hora boliviana.
- **Ficha:** descripción, referencia, contactos actuales, técnico o «Sin
  asignar», ubicación del servicio, fechas y cancelación si está registrada.
  No se abren referencias arbitrarias de evidencia. OpenStreetMap se abre solo
  al pulsar el botón, en otra pestaña sin referrer; comparte únicamente el punto.
- **Historial:** fecha, estados, actor y observación reales. Un actor ausente es
  «Actor no registrado», no una actividad del sistema inventada. Una orden sin
  transiciones no genera eventos al consultarla.
- **Privacidad:** solo administradores activos y sesión vigente. Listado sin
  contactos, dirección exacta, coordenadas ni URLs. Todas las respuestas usan
  `no-store`. Cuentas inactivas no ocultan órdenes históricas; identidades
  eliminadas se muestran sin nombre original, ID de cuenta ni contacto.

`#admin/ordenes?orden=ID` restaura la ficha tras F5. Volver desde la ficha
conserva filtros y página de la pantalla; no se guardan datos personales en la
URL. Los enlaces `?usuario=ID` de Usuarios y Técnicos siguen funcionando.
Web menor de 1024 px y nativo conservan el aviso de backoffice web.

La fase reutiliza el esquema actual, sin migración nueva ni cambios a la
máquina de estados. La reparación continúa requiriendo cotización aceptada y
la asignación debe pasar por el flujo de ofertas cuando se implemente.

>>>>>>> main
### Gestión de técnicos (W61) y revisión documental (W49)

En **Personas → Técnicos**, el directorio incluye cuentas activas/inactivas,
borradores y técnicos con aprobaciones anteriores. Busca por nombre, correo o ID
y filtra por estado de cuenta, expediente, disponibilidad declarada y especialidad.
No transporta CI, fecha de nacimiento ni documentos en el listado.

La ficha tiene tres áreas:

- **Perfil y cobertura:** contacto, fechas registradas, especialidades y zonas
  declaradas. El radio es aproximado; no es un mapa en vivo ni representa la
  ubicación actual. No se inventan métricas, cuentas bancarias ni verificaciones.
- **Documentos y revisión:** CI declarado, fecha y descarga privada de archivos.
  Las referencias antiguas sin archivo privado se identifican como tales y no
  muestran botones de descarga falsos. Se comparte `ExpedienteTecnicoAdmin`
  con **Validar técnicos**: selección de campos observados, confirmación de
  observación/aprobación/rechazo, reglas y auditoría existentes en Postgres.
- **Historial:** revisiones documentales de `identity.revisiones_tecnico` y,
  por separado, cambios de cuenta de `admin_svc.auditoria_usuarios`. Páginas
  de 20 registros; no se reconstruyen decisiones anteriores sin auditoría.

**Activación y aprobación son distintas.** Desactivar/reactivar desde la ficha
usa el mismo endpoint auditado de Usuarios, con revisión optimista, motivo,
revocación de sesiones y bloqueo si tiene órdenes en curso. No cambia la
aprobación, especialidades ni disponibilidad. Aprobar un expediente de una cuenta
inactiva tampoco la reactiva. El administrador puede consultar y descargar
documentos de una cuenta inactiva; el técnico sigue sin poder acceder.

`#admin/tecnicos?usuario=ID` restaura la ficha tras F5 sin guardar formularios ni
documentos. Los borradores de revisión se protegen al navegar por el sidebar o
cerrar/recargar la página. **Invitar técnico** reutiliza el alta por SMTP, sin
aprobarlo; los datos generales se editan desde Usuarios y no hay borrado físico.
La revisión no introduce OTP obligatorio ni modifica aprobaciones anteriores.
Esta fase usa el esquema existente: no requiere una migración nueva.

### Catálogo administrativo (W52)

En Expo web a partir de 1024 px, entrá como administrador y elegí **Catálogo**.
Permite buscar, filtrar por estado, crear y editar categorías y previsualizar
la visita con recargo de urgencia. No publica la comisión interna ni simula pagos.
En ventanas más angostas y en nativo se conserva el aviso de backoffice web.

- Cuerpo de POST/PUT: `nombre`, `descripcion`, `activa`, `tarifaVisita`,
  `tarifaHora` (opcional), `recargoUrgenciaPct`, `moneda` (`BOB`) y `comisionPct`.
- Importes no negativos, hasta dos decimales; porcentajes entre 0 y 100.
  Nombres únicos sin distinguir mayúsculas ni espacios en los extremos.
- V10/V11 concentran el guardado en `admin_svc.guardar_categoria`. Validan
  administrador activo y `app.usuario_id` dentro de la transacción.
- Desactivar requiere confirmación y oculta la categoría del catálogo público;
  no elimina registros ni modifica cotizaciones o liquidaciones existentes.
- Solo se versionan precios modificados: el mismo día se corrige la fila,
  otro día se cierra la anterior al día previo y se abre una nueva. Cambiar
  nombre, descripción o estado no renueva las vigencias de precios.
- `admin_svc.auditoria_catalogo` conserva actor, fecha y fotos antes/después.
  La foto anterior se toma bajo lock para serializar cambios simultáneos.
  Las programaciones futuras se rechazan en este editor, sin sobrescribirlas.

### Probar el onboarding técnico

1. `docker compose up -d --build backend mailpit` desde la raíz; Expo web en `http://localhost:9081`.
2. “Soy técnico” → crear cuenta → completar expediente. **No hay OTP obligatorio**.
3. Completá CI/fecha de nacimiento, frente/dorso, al menos un certificado técnico, especialidades y cobertura. JPG/PNG/PDF hasta 8 MB; máximo 5 certificados. La geolocalización pide permiso; también podés ingresar coordenadas manualmente.
4. Enviá a revisión. El expediente no se puede editar mientras está en revisión ni después de aprobar/rechazar.
5. En otra sesión de navegador, entrá como admin (`admin@fixly.bo` / `Fixly2026!`, solo desarrollo) → “Validar técnicos”. Descargá documentos para revisarlos y observá campos concretos o confirmá aprobación/rechazo.
6. El técnico toca “Actualizar estado”, corrige solo lo observado y reenvía. Al aprobar, accede al panel técnico. Cada decisión queda en `identity.revisiones_tecnico`.

Modo mixto: completitud automática y revisión humana de identidad y certificados. **No hay OCR, biometría ni comprobación automática de autenticidad documental.** Sin REJAP, SMS ni datos de cobro. El nivel 2 indica expediente completo; solo el aprobado (nivel 3) puede aceptar ofertas. V8 elimina el email como requisito sin inventar verificaciones; las aprobaciones e historial existentes se conservan.

### Recuperar contraseña con Mailpit

1. En login tocá **¿Olvidaste tu contraseña?** e ingresá el correo de una cuenta con contraseña.
2. Abrí **http://localhost:8025** y leé el mensaje de recuperación. Mailpit captura correos: no los entrega a Gmail ni a otras casillas externas.
3. Ingresá el código de seis dígitos, elegí una nueva contraseña e iniciá sesión nuevamente.

El código nunca se devuelve ni se registra en logs: vence en 10 minutos, admite 5 intentos, 60 segundos entre envíos y 5 envíos/hora por email. Confirmarlo emite una autorización aleatoria de 32 bytes con vigencia de 10 minutos; se guarda solo su hash y se consume al cambiar contraseña. Los fallos HTTP 400 no revierten el contador. Solicitar otro código invalida el anterior. Cambiar la clave incrementa `version_sesion`: todos los JWT anteriores dejan de entrar, incluso antes de su vencimiento.

La solicitud responde igual para cuentas inexistentes, inactivas, exclusivamente Google, límite alcanzado o fallo SMTP. El texto es condicional; nunca confirma una entrega fallida ni revela la existencia de la cuenta. Si usás solo Google, volvé por Google: Fixly no cambia su contraseña. Los permisos y contraseñas del formulario permanecen solo en memoria; recargar reinicia el recorrido.

Tests: `.\gradlew.bat test --tests "*RecuperacionControllerTest"` desde `backend/`, con PostgreSQL vivo.

### Activar “Continuar con Google”

La integración está preparada, pero **no se habilita ni se afirma probada con Google real sin los IDs de Google Cloud**. Login con Google y SMTP a Gmail son integraciones independientes.

1. Creá/configurá la pantalla de consentimiento de Google Cloud y un cliente OAuth de tipo **Web**. Registrá `http://localhost:9081` como origen JavaScript para desarrollo y tu dominio HTTPS en producción. No hace falta un client secret en la app.
2. En `mobile/.env.local` definí `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. En `.env` de la raíz agregá el mismo ID a `GOOGLE_CLIENT_IDS` (separados por coma si hay varios). Reiniciá Metro y recreá el backend con `docker compose up -d --build backend`.
3. Web usa el botón oficial de Google Identity Services, callback en memoria y nonce emitido por el backend.
4. Nativo usa `react-native-nitro-google-signin` y requiere **development build, no Expo Go**. Configurá los clientes Android/iOS reales en Google Cloud, SHA-1 de los certificados de Android, package/bundle IDs y URL scheme invertido de iOS. Completá `ANDROID_PACKAGE`, `IOS_BUNDLE_IDENTIFIER`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME` y luego `EXPO_PUBLIC_GOOGLE_NATIVE_ENABLED=true`. `app.config.ts` agrega el plugin con Web ID + scheme; reconstruí el binario según la [guía de Expo](https://docs.expo.dev/guides/google-authentication/). No se generan ni editan carpetas nativas a mano.

Sin IDs, Google queda oculto. El backend valida firma RS256 contra claves de Google, emisor, audiencia permitida, vencimiento, email verificado y nonce de un solo uso. Solo crea clientes persona; no otorga roles de técnico/admin. Si faltan nombres, se piden sin inventarlos. Las cuentas Google no tienen contraseña ficticia.

Si ya existe una cuenta con el mismo correo, el acceso se rechaza sin fusionar. Entrá con tu contraseña → **Perfil → Vincular mi cuenta con Google**, confirmá la contraseña actual y elegí Google con el mismo email. La vinculación es explícita y requiere sesión válida.

Tests sin conexión a Google: `VerificadorGoogleTest` comprueba firmas RSA reales generadas para test y claims inválidos; `GoogleControllerTest` usa verificador simulado para comprobar políticas, consumo del nonce y vinculación. No sustituyen el ensayo real de OAuth ni la validación en dispositivos.

Documentos en volumen privado `documentos_data`; no borrar ese volumen para actualizar el backend. En producción configurar `SMTP_HOST/PORT/USERNAME/PASSWORD/AUTH/STARTTLS/FROM`, un volumen persistente protegido y backups/cifrado según la política de datos; **Mailpit es solo desarrollo** y sus puertos se publican únicamente en loopback.

Tests específicos: desde `backend/`, `.\gradlew.bat test --tests "*TecnicoControllerTest"`. Requieren Postgres vivo; usan email simulado y archivos temporales, y limpian únicamente sus propias cuentas de prueba. No equivalen a probar cámara/permisos en un dispositivo nativo.

### Referencias visuales

El rediseño mantiene Fixly Blue, Hanken Grotesk e Inter, sin marcos de dispositivos ni datos de demostración. Login/recuperación comparten composición responsive; el expediente usa progreso lateral en PC y compacto en móvil. Admin separa cola/detalle y permite elegir campos observados en vez de mostrar siete formularios vacíos.

Variantes nuevas de Stitch, sin sobrescribir originales:
- W63 refinado: `projects/4476129839944046705/screens/e0b8cacf8f1d4ae9b75bf0aaa9c5531f`.
- F08 accesible: `projects/3860045202194295758/screens/fabc2bfabe1f492c85f2eee1a56617c9`.

Se traduce su jerarquía a React Native; no se copian alturas rígidas, falsas promesas de seguridad ni los adornos generados de Stitch.

### Probar el login

```powershell
curl.exe -s -X POST http://localhost:8080/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"diego.vargas@ejemplo.bo","password":"Fixly2026!"}'

# Con el token de la respuesta:
curl.exe -s -H "Authorization: Bearer <token>" http://localhost:8080/api/ordenes
```

Una cuenta inactiva o eliminada solo recibe `CUENTA_INACTIVA` si la contraseña es correcta; con contraseña incorrecta se responde igual que un email inexistente.

### Probar el registro

```powershell
curl.exe -s -X POST http://localhost:8080/api/auth/registro `
  -H "Content-Type: application/json" `
  -d '{"nombre":"Ana","apellido":"Quispe","email":"ana@prueba.bo","password":"ClaveSegura2026!","tipoCliente":"persona"}'

# Empresa (requiere razón social y NIT; el campo rol se ignora siempre):
curl.exe -s -X POST http://localhost:8080/api/auth/registro `
  -H "Content-Type: application/json" `
  -d '{"nombre":"Carlos","apellido":"Mendoza","email":"compras@prueba.bo","password":"ClaveSegura2026!","tipoCliente":"empresa","razonSocial":"Servicios Norte S.R.L.","nit":"7654321"}'
```

Errores propios del registro: `409 EMAIL_YA_REGISTRADO`, `409 NIT_YA_REGISTRADO`, `400 DATOS_EMPRESA_INCOMPLETOS`, `400 DATOS_INVALIDOS` (validación de campos, p. ej. contraseña menor a 8 caracteres).

### Formato de errores

Todos los errores usan la misma forma, en español:

```json
{ "codigo": "EMAIL_DUPLICADO", "mensaje": "Ya existe un usuario con ese email.", "campos": [] }
```

`campos` solo se llena en errores de validación: `[{ "campo": "email", "mensaje": "…" }]`.

| HTTP | Cuándo |
|---|---|
| 400 | `DATOS_INVALIDOS` — validación de campos o cuerpo ilegible |
| 401 | `NO_AUTENTICADO` (sin token o token inválido), `CREDENCIALES_INVALIDAS`, `CUENTA_INACTIVA` |
| 403 | `PERMISO_INSUFICIENTE` — rol insuficiente o `42501` en la base |
| 405 | `METODO_NO_PERMITIDO` — método HTTP no soportado en la ruta |
| 409 | `REGISTRO_DUPLICADO` (SQLSTATE `23505`), `REFERENCIA_INVALIDA` (`23503`) |
| 415 | `TIPO_CONTENIDO_NO_SOPORTADO` — el cuerpo no es `application/json` |
| 422 | `REGLA_NEGOCIO` — `23502`/`23514` o `RAISE` de una función PL/pgSQL |
| 503 | `BASE_NO_DISPONIBLE` en `/api/ping` |
| 500 | `ERROR_INTERNO`; jamás se filtra el mensaje crudo de Postgres |

## Flujo de trabajo con Git

Se usa **GitHub Flow / trunk-based**, sin rama `develop`:

| Rama | Uso |
|---|---|
| `main` | siempre estable y protegida |
| `feature/<tema>` | funcionalidad nueva; sale de `main` |
| `fix/<tema>` | corrección no urgente |
| `chore/<tema>` | configuración, docs, dependencias |
| `hotfix/<tema>` | corrección urgente en producción; sale de `main` |

- Las ramas son cortas: se mergean por PR y se borran.
- Merge de features con **squash** para mantener `main` limpia.
- Versiones estables con tag: `v0.1.0`, `v0.2.0`, etc.
- Commits con Conventional Commits: `feat(auth): ...`, `fix(orders): ...`, `chore(db): ...`, `docs: ...`.
- `main` protegida en GitHub: PR obligatorio, sin force push y sin borrado.

## Roadmap

- [x] Docker Compose con PostGIS
- [x] Esquema v2 y datos iniciales
- [x] Env examples y documentación base
- [x] Paso 0: `/api/ping`, `SecurityFilterChain`, CORS y errores JSON
- [x] Capa de datos JPA/Hibernate espejo de la v2 (esquemas `identity` y `orders`)
- [x] Contexto de auditoría por transacción (`app.usuario_id`)
- [x] Seeds de La Paz (V2) y verificación de arranque limpio
- [x] Tests de integración contra Postgres real (sin Testcontainers ni H2)
- [ ] Login con JWT, BCrypt y admin inicial
- [ ] CRUD de categorías con validaciones
- [ ] CRUD de usuarios y aprobación de técnicos
- [ ] Login mobile, almacenamiento de token e interceptor
- [ ] Pantallas de administración en la app
- [ ] CI (tests backend + typecheck mobile)
- [x] Web exportada con TypeScript y servida por Nginx dentro de Docker

## Troubleshooting

- **Configuración local:** `.env` es opcional; Compose tiene defaults. Si ya existe, revisá que corresponda a las credenciales del volumen de Postgres.
- **Error de autenticación de Postgres en `bootRun`:** `POSTGRES_PASSWORD` no coincide con `application.yml`; exportá `SPRING_DATASOURCE_PASSWORD` o alineá los valores.
- **Flyway checksum mismatch:** editaste una migración aplicada. En desarrollo, recreá la base con `docker compose down -v`; en producción, nunca edites una migración.
- **Android no conecta a la API:** usá `http://10.0.2.2:9080`, no `localhost`.
- **Teléfono físico no conecta:** usá la IP LAN de la PC y permití `9080`/`9081` en el firewall.
- **Puerto ocupado:** cambiá `WEB_PORT`, `BACKEND_PORT` o el puerto correspondiente en `.env`. Metro y la web Docker no pueden ocupar 9081 a la vez.
- **Expo Go no abre el proyecto:** la versión de Expo Go debe soportar SDK 58; si no, generá un development build.
- **TypeScript:** no hay lint ni tests en mobile; el chequeo mínimo es `npx tsc --noEmit`.

## Documentación

- `AGENTS.md`: guía para agentes/IA y comandos del repo.
- `mobile/AGENTS.md`: reglas específicas de Expo.

## Licencia

Licencia del proyecto: a definir. El archivo `mobile/LICENSE` corresponde al template de Expo (MIT, 650 Industries) y no representa la licencia de este proyecto.

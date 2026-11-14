# Sistema de Técnicos a Domicilio

Plataforma para solicitar servicios técnicos a domicilio: los clientes publican una orden, los técnicos reciben ofertas, y el administrador valida cuentas y gestiona el catálogo. Incluye base geoespacial, chat, cotizaciones versionadas, pagos, liquidaciones y reputación.

> **Estado:** en desarrollo. La base de datos v2 y la infraestructura están listas; autenticación, CRUD de administración y pantallas mobile están en construcción.

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
├─ docker-compose.yml               Postgres/PostGIS + backend
├─ .env.example                     variables de Docker y auth
├─ AGENTS.md                        guía para agentes/IA
└─ README.md
```

## Requisitos

- **Docker Desktop** con Compose v2 (en Windows, backend WSL2).
- **Node.js 22 LTS** y npm (vienen juntos).
- **JDK 21** solo si vas a correr el backend fuera de Docker.
- **Expo Go** en el teléfono (SDK 58) o **Android Studio** para emulador.
- **Git**.

No hace falta instalar React Native CLI ni Expo CLI global: se usan con `npx`.

## Puesta en marcha

### 1. Clonar y configurar

```powershell
git clone https://github.com/yovasx/sistema-tecnicos.git
cd sistema-tecnicos
Copy-Item .env.example .env
```

Generá un secreto para JWT y pegalo en `JWT_SECRET` dentro de `.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Levantar base de datos y backend

```powershell
docker compose up -d --build
docker compose logs -f backend
```

Flyway aplica las migraciones al iniciar. El backend queda publicado en `http://localhost:9080` (el contenedor escucha en `8080`).

### 3. Levantar la app mobile

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
| Backend en Docker | `9080` (host) → `8080` (contenedor) |
| Backend con `bootRun` | `8080` |
| Expo / Metro | `9081` |

## Variables de entorno

### Raíz (`.env`)

| Variable | Default | Uso |
|---|---|---|
| `POSTGRES_DB` | `tecnicos_db` | nombre de la base |
| `POSTGRES_USER` | `tecnicos_user` | usuario de Postgres |
| `POSTGRES_PASSWORD` | `password` | contraseña de Postgres |
| `POSTGRES_PORT` | `5432` | puerto publicado de Postgres |
| `BACKEND_PORT` | `9080` | puerto publicado del backend |
| `JWT_SECRET` | — | secreto HMAC (mínimo 32 bytes); lo usa el módulo de auth |
| `JWT_ISSUER` | `tecnicos-api` | emisor del token |
| `JWT_TTL_MINUTES` | `30` | vigencia del access token |
| `ADMIN_EMAIL` | `admin@tecnicos.local` | admin inicial (bootstrap) |
| `ADMIN_PASSWORD` | — | contraseña del admin inicial |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:9081` | orígenes permitidos para Expo web |

`JWT_*` y `ADMIN_*` quedan preparadas para el módulo de autenticación; todavía no las consume el backend.

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

Los técnicos nacen `aprobado` y `disponible` para que el matching encuentre candidatos desde el primer día. **Nunca sembrar esta migración en producción.**

Verificar el historial:

```powershell
docker compose exec postgres psql -U tecnicos_user -d tecnicos_db `
  -c "select version, description, success from flyway_schema_history order by installed_rank;"
```

## API (roadmap)

| Método | Endpoint | Estado |
|---|---|---|
| GET | `/api/ping` | ✅ implementado; devuelve 200 con estado real de la base, o 503 si no responde |
| POST | `/api/auth/login` | pendiente |
| GET | `/api/auth/me` | pendiente |
| GET/POST/PUT | `/api/admin/categorias` | pendiente |
| GET/PATCH | `/api/admin/usuarios` | pendiente |
| GET | `/api/admin/tecnicos/pendientes` | pendiente |
| POST | `/api/admin/tecnicos/{id}/aprobar` | pendiente |
| POST | `/api/admin/tecnicos/{id}/rechazar` | pendiente |

Hoy el resto de la API devuelve **403**: `SecurityConfig` exige autenticación pero todavía no hay JWT. Eso se cierra con el login.

### Formato de errores

Todos los errores usan la misma forma, en español:

```json
{ "codigo": "EMAIL_DUPLICADO", "mensaje": "Ya existe un usuario con ese email.", "campos": [] }
```

`campos` solo se llena en errores de validación: `[{ "campo": "email", "mensaje": "…" }]`.

| HTTP | Cuándo |
|---|---|
| 400 | `DATOS_INVALIDOS` — validación de campos |
| 401 | sin token (cuando exista JWT) |
| 403 | `PERMISO_INSUFICIENTE` — rol insuficiente o `42501` en la base |
| 409 | `REGISTRO_DUPLICADO` (SQLSTATE `23505`), `REFERENCIA_INVALIDA` (`23503`) |
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
- [ ] Perfil Docker opcional para el build web

## Troubleshooting

- **`docker compose` falla por variables vacías:** falta `.env`; copiá `.env.example`.
- **Error de autenticación de Postgres en `bootRun`:** `POSTGRES_PASSWORD` no coincide con `application.yml`; exportá `SPRING_DATASOURCE_PASSWORD` o alineá los valores.
- **Flyway checksum mismatch:** editaste una migración aplicada. En desarrollo, recreá la base con `docker compose down -v`; en producción, nunca edites una migración.
- **Android no conecta a la API:** usá `http://10.0.2.2:9080`, no `localhost`.
- **Teléfono físico no conecta:** usá la IP LAN de la PC y permití `9080`/`9081` en el firewall.
- **Puerto ocupado:** cambiá `BACKEND_PORT` en `.env` o el puerto del script de Expo.
- **Expo Go no abre el proyecto:** la versión de Expo Go debe soportar SDK 58; si no, generá un development build.
- **TypeScript:** no hay lint ni tests en mobile; el chequeo mínimo es `npx tsc --noEmit`.

## Documentación

- `AGENTS.md`: guía para agentes/IA y comandos del repo.
- `mobile/AGENTS.md`: reglas específicas de Expo.

## Licencia

Licencia del proyecto: a definir. El archivo `mobile/LICENSE` corresponde al template de Expo (MIT, 650 Industries) y no representa la licencia de este proyecto.

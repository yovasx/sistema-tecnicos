# AGENTS.md

Dos proyectos independientes, sin workspace raíz. Los comandos Java/npm se ejecutan desde `backend/` o `mobile/`; Docker Compose desde la raíz. CI en `.github/workflows/docker.yml`.

- `backend/` — Spring Boot 4.1.1, Java 21, Gradle wrapper 9.8.1, Flyway + PostgreSQL/PostGIS.
- `mobile/` — Expo SDK 58, React Native 0.88, TypeScript estricto, npm.
- `docker-compose.yml` — web compilada (Nginx), backend, Postgres/PostGIS, RabbitMQ y Mailpit. `docker compose up -d` levanta todo sin `.env` ni herramientas locales; defaults solo para desarrollo/demo, puertos ligados a loopback.
- `mobile/Dockerfile` usa Node 22, `npm ci`, TypeScript y export web; excluye `.env*`. API web `/` por proxy `/api` de Nginx, sin URLs localhost incrustadas. Google web se configura por build arg público; ningún secreto en la imagen web.
- `backend/Dockerfile` compila con el wrapper versionado dentro de Java 21; normaliza CRLF, verifica distribución Gradle por SHA-256, no oculta errores. Runtime no root y healthcheck `/api/ping` que consulta la BD. Perfil `pruebas` corre suite Java en Docker con Postgres real.
- No fijar `container_name`: permitir proyectos aislados con `docker compose -p ...`. Nunca borrar volúmenes del usuario para verificar arranque desde cero.

## Backend

```powershell
docker compose up -d postgres    # desde la raíz; Flyway necesita la base viva
cd backend
.\gradlew.bat bootRun            # :8080, usa application.yml
.\gradlew.bat test               # suite completa
.\gradlew.bat test --tests "com.tecnicos.tecnicos_backend.TecnicosBackendApplicationTests"
docker compose up -d --build     # desde la raíz; backend publicado en :9080
```

- `test` levanta el contexto Spring y corre Flyway: **requiere Postgres ya arriba**. No hay Testcontainers ni H2; sin base, los tests fallan.
- Spring **no** lee el `.env` de la raíz (solo docker-compose). `application.yml` usa `SPRING_DATASOURCE_*` con defaults locales (`localhost:5432/tecnicos_db`, `tecnicos_user`/`password`); docker-compose inyecta esas variables.
- Si cambiás `POSTGRES_PASSWORD` en `.env`, exportá `SPRING_DATASOURCE_PASSWORD` antes de `bootRun` para que coincida.
- No hay lint, formatter ni análisis estático configurados. `HELP.md` está generado e ignorado por git.
- El Dockerfile compila con `bootJar -x test`: la imagen no valida los tests.

### Esquema

- Flyway es la única fuente del esquema (`src/main/resources/db/migration`); Hibernate usa `ddl-auto: validate` y no crea nada. Las entidades JPA deben coincidir exactamente con el SQL.
- La v2 es la migración base: `V1__plataforma_tecnicos_v2.sql` (squash de las antiguas V1..V7). No la edites una vez aplicada; los cambios futuros van en `V2__...sql`.
- Esquemas existentes: `identity`, `orders`, `geo`, `billing`, `chat`, `reputation`, `admin_svc`, `notification`. Desde la v2 los IDs son `BIGINT`/`INT IDENTITY` (no UUID); tablas y columnas en español, reglas de negocio en constraints y triggers.
- Los enums son tipos nativos de Postgres y están en minúsculas (`cliente`, `tecnico`, `administrador`). En Java mapearlos con `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` o un converter; no asumir mayúsculas.
- La v2 implementa en la base la máquina de estados, matching, cotizaciones, pagos y reputación. Para esos flujos llamá a las funciones (`orders.aceptar_oferta`, `billing.responder_cotizacion`, etc.) en vez de duplicar las reglas en Java.
- La auditoría de triggers lee `app.usuario_id` vía `orders.usuario_actual()`; hay que setearlo dentro de la transacción (`set_config('app.usuario_id', ..., true)`), no en un filtro fuera de ella.
- Para recrear la base de desarrollo: `docker compose down -v` y volver a levantar. **Borra todos los datos.**
- Backend implementado: `/api/ping`, autenticación JWT/registro clientes, catálogo público, administración del catálogo, onboarding técnico, consulta administrativa de órdenes y solicitud de servicio del cliente con seguimiento propio. La asignación, el diagnóstico/cotización, la reparación y las liquidaciones siguen pendientes.
- Órdenes W46/W47: GET `/api/admin/ordenes`, GET `/{id}` y GET `/{id}/historial`, solo lectura y `no-store`. Filtros `busqueda` (ID exacto/nombres), `estado`, `categoria`, `asignacion`, `desde`, `hasta`, `pagina`, `tamano`; fechas de Bolivia inclusivas por día con fin exclusivo. No exponer ubicación/contactos en listado, ni evidencia arbitraria en detalle. Cuentas inactivas conservan órdenes; identidades eliminadas se enmascaran. No agregar POST/PUT/PATCH ni selector libre de estados sin definir el flujo operativo y permisos. Sin migración nueva para esta fase.
- Catálogo W52: GET/POST `/api/admin/categorias`, PUT `/api/admin/categorias/{id}`. V10/V11: `admin_svc.guardar_categoria` guarda categoría/tarifa/comisión atómicamente y audita antes/después con actor de transacción. Solo BOB; sin borrado físico. Solo versionar importes modificados: mismo día actualiza, otro día cierra anterior; cambiar texto/estado no renueva precios. No sobrescribir programaciones futuras ni editar V10/V11 aplicadas.
- Solicitudes V14: POST/GET `/api/ordenes`, GET `/api/ordenes/categorias`, GET `/{id}` y GET `/{id}/evidencia`. Solo cliente activo; `orders.crear_solicitud_cliente` valida en Postgres, exige clave UUID + huella SHA-256 (idempotencia y concurrencia), crea la orden en `solicitado` y audita con `app.usuario_id`. No genera ofertas, cotizaciones, técnico, precio ni ETA. Evidencia JPG/PNG/PDF ≤8 MB como archivo privado `/perfiles/<uuid>.<ext>`; descarga solo dueño/admin, `no-store`, `attachment` y `nosniff`. No permitir cancelar, reasignar ni forzar estados desde el cliente. No editar V14 aplicada.
- Usuarios W48: V12 agrega `revision_admin`, funciones de edición/estado y `admin_svc.auditoria_usuarios`. GET `/api/admin/usuarios/pagina`, GET/PUT `/{id}`, PATCH `/{id}/estado`, GET `/{id}/historial`; GET antiguo se conserva. PUT/PATCH exigen revisión y motivo; 409 si cambió. No editar rol/email/identidades Google ni nombre de técnico aprobado. Sin DELETE; no autodesactivarse ni desactivar con órdenes abiertas. Estado incrementa `version_sesion`; `VersionSesion` rechaza cuentas inactivas/eliminadas en todas las rutas protegidas.
- Inicio y perfil admin: GET `/api/admin/dashboard?dias=7|30` usa snapshot de lectura, fechas de Bolivia y colas de hasta 5; no contactos, ubicación ni importes ficticios. Solo la serie depende del período. Cuenta expedientes enviados de cuentas activas, no borradores. GET/PUT `/api/admin/perfil` toma el destinatario del JWT, exige revisión/motivo y reutiliza edición/auditoría V12; `no-store`, sin migración nueva ni cambio de rol/email/password.
- Invitaciones V13: POST `/api/admin/usuarios/invitaciones` exige JWT admin y contraseña actual; POST público `/api/auth/invitaciones/aceptar` crea cuenta con clave elegida por el destinatario. Permiso aleatorio 256 bits solo por SMTP (hash en BD), 24 h/un uso, 20 envíos/admin/día y 60 s/email. No devolver/loguear permisos ni persistir `passwordAdmin`. Técnico invitado sigue pendiente; no fusionar emails. No modificar V12/V13 una vez aplicadas.
- Técnicos W61: GET `/api/admin/tecnicos` paginado, GET `/{id}` ficha privada, GET `/{id}/revisiones` decisiones documentales. Directorio sin CI/documentos. `TecnicoService.expedienteAdministrativo` permite consultar inactivos solo desde controladores admin; la consulta del propio técnico conserva `perfilActivo`. Estado de cuenta reutiliza Usuarios: no cambiar aprobación/disponibilidad al activar/desactivar. No inventar revisiones de aprobaciones previas ni editar especialidades/cobertura desde un CRUD genérico.
- Expediente técnico: V5 agrega registro técnico, OTP y funciones de edición/envío/revisión; V6 instala `pgcrypto`; V7 agrega auditoría de revisiones. No modificar migraciones aplicadas. `nivel=2` significa expediente completo, no validación biométrica; solo `estado_validacion='aprobado'` habilita aceptar ofertas.
- V8 elimina el email como requisito de edición/envío/aprobación técnica y agrega recuperación, versiones de sesión e identidades Google. V9 agrega desafíos Google. No inventar `email_verificado_en`; conservar verificaciones y aprobaciones previas.
- Recuperación pública: POST `/api/auth/recuperacion/{solicitar,confirmar,restablecer}`. Respuesta genérica incluso SMTP fallido/cuenta Google/ausente; código y permiso solo en memoria y hashes en BD. Al cambiar contraseña se incrementa `version_sesion`; `ConversorJwt` verifica la versión en cada petición. Login toma lock compartido para no emitir tokens con contraseña obsoleta durante un reset.
- Google solo cliente persona: `GOOGLE_CLIENT_IDS` permite las audiencias; firma RS256 contra JWKS Google, issuer/email_verified/exp/nonce y desafío de un uso. No fusionar por email. Vinculación exige JWT local + contraseña actual + Google con mismo email. Cuentas exclusivamente Google tienen `password_hash=NULL` y no adquieren contraseña por recuperación.
- OTP por SMTP real: Mailpit en desarrollo (`docker compose up -d mailpit`, bandeja `http://localhost:8025`, SMTP local :1025). En producción usar proveedor SMTP con TLS/auth. Nunca devolver ni loguear códigos; 10 minutos de vigencia, 5 intentos, 60 segundos entre envíos y 5 envíos/hora. El contador persiste incluso si confirmar devuelve 400.
- Documentos privados: JPG/PNG/PDF hasta 8 MB y 5 certificados; descarga autenticada dueño/admin, `no-store` y attachment. `UPLOADS_DIR` en volumen `documentos_data` en Docker; ignorado en git. No guardar CI ni documentos en JWT/localStorage ni aceptar URLs públicas enviadas por el cliente.

## Mobile

Ver `mobile/AGENTS.md` para las reglas de Expo. Lo esencial:

```powershell
cd mobile
npm install
npm start                 # Expo/Metro en :9081
npx tsc --noEmit          # typecheck; no hay lint ni tests
npx expo install <pkg>    # no uses npm install para dependencias nativas
```

- No es Expo Router: el entrypoint es `index.ts` → `App.tsx` con `registerRootComponent`; no existe `src/app/` ni la dependencia `expo-router`.
- `EXPO_PUBLIC_API_URL` es obligatorio y no tiene fallback (`src/infrastructure/http/apiClient.ts`). Copiá `mobile/.env.example` a `mobile/.env.local`. Web/iOS: `http://localhost:9080`; emulador Android: `http://10.0.2.2:9080`; dispositivo físico: IP LAN de la máquina.
- Capas: `src/domain/` (puertos/interfaces, modelos y repositorios), `src/session/` (estado global de sesión con `SesionProvider` + `useSesion`), `src/infrastructure/` (adaptadores), `src/infrastructure/di.ts` (composition root manual que elige SecureStore o localStorage según `Platform.OS`).
- Navegación real con `@react-navigation/native` + `native-stack` + `bottom-tabs`: `src/navigation/RootNavigator.tsx` elige las tabs por `rol` y por `tipoCliente` (`persona` | `empresa`). El admin entra pero ve aviso de que el panel es el backoffice web.
- `src/ui/` tiene los componentes del design system (BotonPrimario, CampoTexto, Tarjeta, Chip, Texto, Aviso, ContenedorApp, PantallaPendiente). En web ≥1024 se usa shell desktop; por debajo, columna de 420 px ampliada a 640 en tablet. Formularios públicos fluidos con un solo nivel de margen; login/recuperación comparten `MarcoAuth`, tarjeta central solo en escritorio. `CampoTexto` reemplaza el outline web por borde/anillo azul accesible.
- `src/theme/responsive.ts` expone `useResponsive()` (`esDesktop`, `esMovil`, `ancho`). La regla es `Platform.OS === 'web' && ancho >= 1024`: en nativo nunca se activa el escritorio. `RootNavigator` elige `DesktopShell` o las tabs con esa regla; las pantallas de contenido son las mismas en los dos casos.
- `src/navigation/secciones.ts` es la única lista de secciones por rol/perfil (`seccionesClientePersona`, `seccionesEmpresa`, `seccionesTecnico`, `seccionesAdmin`): alimenta el sidebar de escritorio. En el teléfono el admin solo ve el aviso de que el backoffice es web.
- Los anónimos entran al flujo público compartido `src/screens/publico/PublicoFlujo.tsx`: bienvenida F01/W62 → tipoCuenta → registro → sesión. Cliente persona/empresa y alta técnica separada. `AccesoTecnico` consulta el expediente y muestra onboarding/estado hasta aprobación; los técnicos aprobados previos a V5 conservan el acceso sin inventar verificaciones de email.
- Las pantallas sin backend muestran el banner ámbar "Pendiente de V2" de `PantallaPendiente`, con la pantalla de Stitch que las va a implementar. No se inventan datos ni columnas.

## Git

- `main` es la rama estable y protegida. No commitees directo: creá `feature/*`, `fix/*` o `chore/*` desde `main`, abrí PR y mergeá con squash.
- No hay rama `develop`. `hotfix/*` solo para corregir producción. Las versiones estables se etiquetan como `vX.Y.Z` sobre `main`.
- Commits con Conventional Commits (`feat(auth): ...`, `fix(orders): ...`, `chore(db): ...`).

## Convenciones

- Código, textos de UI, comentarios y base de datos en español; no traduzcas identificadores existentes.
- `.env` está en `.gitignore` y es opcional para Compose local; `.env.example` permite personalizar puertos/SMTP/OAuth. La V2 siembra usuarios demo conocidos: el stack no es una configuración de producción pública.

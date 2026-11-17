# AGENTS.md

Dos proyectos independientes, sin workspace raíz, CI ni scripts en la raíz. Ejecutá los comandos desde `backend/` o `mobile/`.

- `backend/` — Spring Boot 4.1.1, Java 21, Gradle wrapper 9.8.1, Flyway + PostgreSQL/PostGIS.
- `mobile/` — Expo SDK 58, React Native 0.88, TypeScript estricto, npm.
- `docker-compose.yml` — Postgres/PostGIS y el backend en contenedor.

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
- Backend implementado: `/api/ping`, autenticación JWT/registro clientes, catálogo público, lecturas admin y onboarding técnico. Las órdenes y liquidaciones siguen pendientes.
- Expediente técnico: V5 agrega registro técnico, OTP y funciones de edición/envío/revisión; V6 instala `pgcrypto`; V7 agrega auditoría de revisiones. No modificar migraciones aplicadas. `nivel=2` significa expediente completo, no validación biométrica; solo `estado_validacion='aprobado'` habilita aceptar ofertas.
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
- `src/ui/` tiene los componentes del design system (BotonPrimario, CampoTexto, Tarjeta, Chip, Texto, Aviso, ContenedorApp, PantallaPendiente). En web con ventana de 1024 px o más se usa el shell de escritorio (sidebar de 240 + topbar de 64 + tablas); por debajo de 1024 y en nativo se ve como columna centrada de 420 px sobre fondo gris, igual que en el teléfono.
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
- `.env` está en `.gitignore` pero es obligatorio para docker-compose; `.env.example` es la plantilla.

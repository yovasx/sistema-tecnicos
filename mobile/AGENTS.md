# Mobile (Expo)

App Expo SDK 58 / React Native 0.88. Los comandos y la arquitectura compartida están en el `AGENTS.md` de la raíz.

## Expo cambia seguido — no confíes en tu memoria

Antes de usar cualquier API de Expo, EAS o React Native:

1. Mirá la versión mayor de `expo` en `package.json` (hoy SDK 58).
2. Consultá los docs de esa versión: `https://docs.expo.dev/versions/v58.0.0/`
3. Para el resto, `https://docs.expo.dev/llms.txt` — seguí sus enlaces; no respondas de memoria.

## Comandos

```powershell
npm install
npm start                  # Expo/Metro en :9081
npx tsc --noEmit           # typecheck; no hay lint ni tests configurados
npx expo install <paquete> # única forma de agregar deps nativas (versión compatible con el SDK)
```

No uses `npx expo lint`: no hay ESLint instalado ni configuración.

## Arquitectura

- Entrypoint `index.ts` → `App.tsx` con `registerRootComponent`. **No es Expo Router**: no hay `app/` ni dependencia `expo-router`.
- Navegación real: `@react-navigation/native` + `native-stack` + `bottom-tabs`; `src/navigation/RootNavigator.tsx` elige tabs por rol y por perfil de cliente (`persona` | `empresa`).
- Estado global de sesión: `src/session/SesionProvider.tsx` + `useSesion()`; restaura con el token del storage y `GET /api/auth/me`. `apiClient` manda `Authorization: Bearer` y ante 401 cierra sesión (excepto en `/login` y `/registro`, donde el 401/409 es del formulario).
- `src/domain/`: puertos/interfaces. `src/infrastructure/`: adaptadores (axios, storage). `src/infrastructure/di.ts`: composition root manual; `Platform.OS` elige SecureStore o localStorage.
- Design system en `src/theme/tokens.ts` + `src/ui/`; Hanken Grotesk + Inter. Web ≥1024 usa shell desktop, columna móvil 420 ampliada a 640 para tablet. Formularios públicos con header mínimo; `MarcoAuth` centra login/recuperación con tarjeta solo desktop. No reintroducir panel azul de media pantalla, marcos de teléfono ni doble padding. Foco de input: borde/anillo azul en wrapper, outline nativo del navegador desactivado solo en TextInput.
- `src/theme/responsive.ts`: `useResponsive()` devuelve `esDesktop` (`Platform.OS === 'web' && ancho >= 1024`), `esMovil` y `ancho`. No uses `Platform.OS` suelto para decidir layout: usá el hook, así redimensionar la ventana cambia de shell en caliente.
- `src/navigation/secciones.ts`: lista única de secciones por rol/perfil que alimenta el sidebar. Si agregás una pantalla, sumala ahí y en las tabs móviles.
- `CatalogoAdminScreen` (W52) edita categorías/tarifas/comisiones con un solo POST/PUT, búsqueda, filtros, vista previa y confirmación de desactivación. Dos columnas desde 1280 px y una entre 1024–1279. Menos de 1024/nativo conserva aviso de backoffice web; no habilitar el catálogo en tabs sin acordarlo. No publicar la comisión ni inventar pagos/garantías en la vista previa.
- Usuarios W48 usa `ui/admin/{TablaAdmin,FiltroAdmin,CambiosAdmin}`: filtros/paginación de servidor, ficha con información/historial, edición con motivo y revisión optimista y baja por desactivación. `CambiosAdmin` protege navegación del sidebar y cierre/recarga web cuando hay borradores. El fragmento `#admin/usuarios?usuario=ID` conserva solo sección e ID; nunca formularios, códigos ni documentos. Sidebar agrupado desde `secciones.ts`.
- Alta administrativa mediante invitación SMTP: `InvitarUsuarioAdmin` exige contraseña actual y confirmación adicional para rol admin. `AceptarInvitacionScreen` se abre desde login con “Tengo una invitación”; mantiene código/password solo en memoria, no inicia sesión automáticamente ni aprueba técnicos. No mostrar botón de borrar físico ni permitir edición genérica de rol/email.
- Técnicos W61: `TecnicosAdminScreen` muestra directorio paginado y ficha (perfil/cobertura, documentos/revisión, historial). `ExpedienteTecnicoAdmin` comparte la revisión con W49; observar/aprobar/rechazar exige confirmación y conserva las funciones SQL existentes. No descargar referencias antiguas si no son archivos privados `/perfiles/<uuid>.<ext>`; indicar referencia anterior sin fingir archivo disponible. Cuenta activa, aprobación y disponibilidad se muestran separadas. Invitar técnico reutiliza `InvitarUsuarioAdmin` con rol fijo; edición general sigue en Usuarios. La navegación conserva solo sección/ID, nunca CI ni documentos.
- Órdenes W46/W47: `OrdenesAdminScreen` y `ordenes/{FichaOrdenAdmin,HistorialOrdenAdmin}` son solo lectura. Filtros se aplican con botón/Enter, sin solicitudes por fechas incompletas; al volver de la ficha conservan criterios/página. `rutaAdmin` admite `?orden=ID` sin romper `?usuario=ID`; no persistir ubicación/contactos en URL. Fechas e historial en `America/La_Paz`; actor ausente no equivale a «Sistema». OpenStreetMap solo por acción explícita, sin mapa/carga de terceros automática. No fabricar totales financieros, SLA, evidencia descargable, órdenes demo ni acciones de reasignación/cambio de estado.
- Solicitud de servicio: `SolicitudServicioProvider` (borrador en memoria, clave UUID y reintento incierto) + `SolicitudServicioWizard` de 4 pasos. `MisServicios` lista y detalla las órdenes propias; `OrdenesEmpresa` reutiliza el mismo componente con título «Órdenes». Categoría activa, descripción 10–2000, urgencia, coordenadas válidas, referencia 5–300 y evidencia JPG/PNG/PDF ≤8 MB. GPS solo al pulsar «Usar mi ubicación»; alternativa manual y OpenStreetMap por acción explícita. Tras crear, la orden queda en `solicitado`: no inventar técnico, precio, ETA ni ofertas. La evidencia se descarga autenticada (`expo-file-system` + `expo-sharing` en nativo, blob en web); nunca URL pública. No duplicar envíos: conservar la clave durante el reintento y no permitir editar mientras el resultado sea incierto. Fechas en `America/La_Paz` con `fechaHoraBolivia`.
- Anónimos: flujo público compartido `PublicoFlujo` (bienvenida F01/W62 → selector de tipo de cuenta → registro en 2 pasos → sesión). En web ≥1024 px se ve la landing rica (W62); en el teléfono, la bienvenida compacta (F01). El login (W63/F03) siempre está disponible.
- “Soy técnico” abre el alta técnica. `AccesoTecnico` bloquea el panel hasta aprobación. Onboarding: CI/fecha → documentos → especialidades → cobertura → revisión, sin OTP obligatorio ni verificaciones ficticias. Progreso lateral desktop/horizontal móvil; tarjetas distinguen documento seleccionado de guardado. Se reanuda tras F5.
- Archivos: `expo-document-picker` compatible SDK 58, JPG/PNG/PDF hasta 8 MB; `TecnicoApiRepository` envía multipart con Blob en web y URI en nativo. No persistir documentos/CI en storage de sesión. `ValidacionAdminScreen` descarga autenticado y observa/aprueba/rechaza con confirmación; no abre URLs de documentos públicas.
- Cobertura: `expo-location` solo consulta puntual y con permiso al tocar “Usar mi ubicación”; sin seguimiento/background. Coordenadas manuales y enlace externo a OpenStreetMap como alternativa. Mailpit `http://localhost:8025` permite leer el email OTP en desarrollo; jamás mostrar el código desde la API.
- El cliente HTTP lee solo `EXPO_PUBLIC_API_URL`, sin fallback. Valores: `http://localhost:9080` (web/iOS), `http://10.0.2.2:9080` (emulador Android), IP LAN en dispositivo físico.
- Web Docker: `mobile/Dockerfile` ejecuta `npm ci`, TypeScript y export con Node 22. `EXPO_PUBLIC_API_URL=/` conecta por proxy `/api` de Nginx (mismo origen); `.env*` nunca entra al contexto. No usar Metro en el contenedor estable. Puerto predeterminado 9081, alternativo a Metro local. ID Google web por build arg público; cambiarlo requiere reconstruir.

## Nativos

- `ios/` y `android/` no existen: se generan (Continuous Native Generation). No los crees ni edites a mano; configurá en `app.json` y config plugins.
- Expo Go solo trae sus módulos incluidos. Tras agregar una librería con código nativo hace falta un development build: `npx expo run:ios|android` o `eas build --profile development`.
- Todavía no hay `eas.json`: el flujo de EAS (build/submit/update) está sin configurar.
- Google: adaptador web GIS oficial y nativo `react-native-nitro-google-signin` (Credential Manager). IDs vacíos ocultan la opción; nativo también exige `EXPO_PUBLIC_GOOGLE_NATIVE_ENABLED=true` y no Expo Go. `app.config.ts` habilita plugin con Web ID + iOS URL scheme; completar package/bundle IDs reales y generar development build. Nunca agregar client secret al bundle.
- Recuperación guarda solicitud/permiso/password solo en memoria. Mailpit sigue capturando correos en :8025; Google login no implica entrega SMTP a Gmail. `AccesoGoogle` pide nombres solo si faltan; `VincularGoogle` exige contraseña y sesión local.

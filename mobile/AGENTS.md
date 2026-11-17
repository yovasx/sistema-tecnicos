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
- Design system en `src/theme/tokens.ts` + `src/ui/`; fuentes Hanken Grotesk + Inter cargadas con `expo-font`. En web con ventana de 1024 px o más la app usa el shell de escritorio (`src/layouts/DesktopShell.tsx`: sidebar 240 + topbar 64) y por debajo de 1024 queda la columna centrada de 420 px. En nativo siempre es móvil.
- `src/theme/responsive.ts`: `useResponsive()` devuelve `esDesktop` (`Platform.OS === 'web' && ancho >= 1024`), `esMovil` y `ancho`. No uses `Platform.OS` suelto para decidir layout: usá el hook, así redimensionar la ventana cambia de shell en caliente.
- `src/navigation/secciones.ts`: lista única de secciones por rol/perfil que alimenta el sidebar. Si agregás una pantalla, sumala ahí y en las tabs móviles.
- Anónimos: flujo público compartido `PublicoFlujo` (bienvenida F01/W62 → selector de tipo de cuenta → registro en 2 pasos → sesión). En web ≥1024 px se ve la landing rica (W62); en el teléfono, la bienvenida compacta (F01). El login (W63/F03) siempre está disponible.
- El cliente HTTP lee solo `EXPO_PUBLIC_API_URL`, sin fallback. Valores: `http://localhost:9080` (web/iOS), `http://10.0.2.2:9080` (emulador Android), IP LAN en dispositivo físico.

## Nativos

- `ios/` y `android/` no existen: se generan (Continuous Native Generation). No los crees ni edites a mano; configurá en `app.json` y config plugins.
- Expo Go solo trae sus módulos incluidos. Tras agregar una librería con código nativo hace falta un development build: `npx expo run:ios|android` o `eas build --profile development`.
- Todavía no hay `eas.json`: el flujo de EAS (build/submit/update) está sin configurar.

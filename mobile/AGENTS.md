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
- Navegación: `@react-navigation/native` + `@react-navigation/native-stack` (instalados, todavía sin usar).
- `src/domain/`: puertos/interfaces. `src/infrastructure/`: adaptadores (axios, storage). `src/infrastructure/di.ts`: composition root manual; `Platform.OS` elige SecureStore o localStorage.
- El cliente HTTP lee solo `EXPO_PUBLIC_API_URL`, sin fallback. Valores: `http://localhost:9080` (web/iOS), `http://10.0.2.2:9080` (emulador Android), IP LAN en dispositivo físico.

## Nativos

- `ios/` y `android/` no existen: se generan (Continuous Native Generation). No los crees ni edites a mano; configurá en `app.json` y config plugins.
- Expo Go solo trae sus módulos incluidos. Tras agregar una librería con código nativo hace falta un development build: `npx expo run:ios|android` o `eas build --profile development`.
- Todavía no hay `eas.json`: el flujo de EAS (build/submit/update) está sin configurar.

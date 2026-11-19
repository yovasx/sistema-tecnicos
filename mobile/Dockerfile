# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
# Solo configuración pública. Nunca copiar .env.local ni secretos al bundle.
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=""
ENV EXPO_PUBLIC_API_URL=/ \
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=${EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID} \
    EXPO_PUBLIC_GOOGLE_NATIVE_ENABLED=false
RUN npx tsc --noEmit && npx expo export --platform web

FROM nginx:1.28-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
    CMD wget -q -O /dev/null http://127.0.0.1/salud || exit 1

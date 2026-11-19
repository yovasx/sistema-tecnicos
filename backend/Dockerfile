# syntax=docker/dockerfile:1
# El wrapper versionado compila dentro de Linux; no requiere Gradle en el host.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
ENV GRADLE_USER_HOME=/opt/gradle-cache

COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew
COPY src ./src
RUN --mount=type=cache,target=/opt/gradle-cache \
    ./gradlew bootJar --no-daemon --console=plain -x test

# Pruebas optativas en Compose: usan Postgres real y no forman parte del arranque.
FROM build AS pruebas
CMD ["./gradlew", "test", "--no-daemon", "--console=plain"]

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl gosu \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 fixly \
    && useradd --uid 10001 --gid fixly --no-create-home fixly \
    && mkdir -p /app/uploads && chown fixly:fixly /app/uploads
COPY --from=build /app/build/libs/*.jar app.jar
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=12 \
    CMD curl --fail --silent --max-time 4 http://localhost:8080/api/ping > /dev/null || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]

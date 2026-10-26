-- =============================================================================
-- V4: Módulo GEO (zonas de cobertura y ubicación) — RF-10 a RF-13
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS geo;

CREATE TABLE geo.zonas_cobertura (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tecnico_id  UUID         NOT NULL REFERENCES identity.perfiles_tecnico(usuario_id) ON DELETE CASCADE,
    nombre_zona VARCHAR(100) NOT NULL,
    poligono    GEOGRAPHY(POLYGON, 4326) NOT NULL,
    activa      BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_zona_poligono_valido CHECK (ST_IsValid(poligono::geometry))
);
CREATE INDEX idx_zonas_tecnico   ON geo.zonas_cobertura(tecnico_id);
CREATE INDEX idx_zonas_poligono  ON geo.zonas_cobertura USING GIST (poligono) WHERE activa;

-- ÚLTIMA posición conocida: una fila por técnico (se actualiza con UPSERT cada ≤10 s, RNF-02).
-- Así la tabla nunca crece y la búsqueda de "técnicos cercanos" es rápida.
CREATE TABLE geo.ubicacion_actual (
    tecnico_id     UUID PRIMARY KEY REFERENCES identity.perfiles_tecnico(usuario_id) ON DELETE CASCADE,
    punto          GEOGRAPHY(POINT, 4326) NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ubicacion_actual_punto ON geo.ubicacion_actual USING GIST (punto);

-- Historial SOLO mientras hay un servicio en curso (para el mapa de seguimiento).
-- Guardar cada ping de cada técnico todo el día haría crecer la tabla sin control.
CREATE TABLE geo.rastro_servicio (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id      UUID        NOT NULL REFERENCES orders.ordenes_servicio(id) ON DELETE CASCADE,
    tecnico_id    UUID        NOT NULL REFERENCES identity.perfiles_tecnico(usuario_id),
    punto         GEOGRAPHY(POINT, 4326) NOT NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rastro_orden ON geo.rastro_servicio(orden_id, registrado_en);

-- Consulta típica (para la Fase 3): ¿qué técnicos cubren esta ubicación?
--   SELECT tecnico_id FROM geo.zonas_cobertura
--   WHERE activa AND ST_Covers(poligono, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography);
-- (En geography se usa ST_Covers; ST_Contains solo existe para geometry.)

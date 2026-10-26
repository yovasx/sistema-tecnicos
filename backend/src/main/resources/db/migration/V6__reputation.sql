-- =============================================================================
-- V6: Módulo REPUTATION (calificaciones e índice) — RF-18 a RF-20
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS reputation;

CREATE TABLE reputation.calificaciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id       UUID        NOT NULL REFERENCES orders.ordenes_servicio(id) ON DELETE CASCADE,
    calificador_id UUID        NOT NULL REFERENCES identity.usuarios(id),
    calificado_id  UUID        NOT NULL REFERENCES identity.usuarios(id),
    puntaje        SMALLINT    NOT NULL,
    comentario     TEXT,
    registrado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_calificacion_puntaje CHECK (puntaje BETWEEN 1 AND 5),
    CONSTRAINT chk_calificacion_distintos CHECK (calificador_id <> calificado_id),
    -- Una calificación por orden y por emisor (bidireccional)
    CONSTRAINT uq_calificacion_por_emisor UNIQUE (orden_id, calificador_id)
    -- Que "solo se califique una orden FINALIZADA entre sus participantes"
    -- es regla de negocio: se valida en el caso de uso (capa de aplicación).
);
CREATE INDEX idx_calificaciones_calificado ON reputation.calificaciones(calificado_id);

-- Índice recalculado por el sistema (RF-19), nunca editado a mano
CREATE TABLE reputation.indices_reputacion (
    tecnico_id            UUID PRIMARY KEY REFERENCES identity.perfiles_tecnico(usuario_id) ON DELETE CASCADE,
    tasa_resolucion       NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tasa_resolucion BETWEEN 0 AND 100),
    puntualidad           NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (puntualidad BETWEEN 0 AND 100),
    calificacion_promedio NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (calificacion_promedio BETWEEN 0 AND 5),
    indice_general        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (indice_general BETWEEN 0 AND 100),  -- prioriza (RF-20)
    actualizado_en        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_reputacion_ranking ON reputation.indices_reputacion(indice_general DESC);

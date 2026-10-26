-- =============================================================================
-- V2: Módulo ORDERS (catálogo de categorías y órdenes de servicio)
-- Dependencia permitida: orders -> identity (nunca al revés)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS orders;

CREATE TABLE orders.categorias_servicio (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL UNIQUE,   -- plomería, electricidad, climatización...
    descripcion TEXT,
    activa      BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Reemplaza especialidades TEXT[]: ahora hay integridad referencial y se puede
-- hacer JOIN para encontrar "técnicos de plomería" con un índice.
CREATE TABLE orders.tecnico_categorias (
    tecnico_id   UUID NOT NULL REFERENCES identity.perfiles_tecnico(usuario_id) ON DELETE CASCADE,
    categoria_id INT  NOT NULL REFERENCES orders.categorias_servicio(id),
    PRIMARY KEY (tecnico_id, categoria_id)
);
CREATE INDEX idx_tecnico_categorias_categoria ON orders.tecnico_categorias(categoria_id);

CREATE TABLE orders.ordenes_servicio (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id         UUID         NOT NULL REFERENCES identity.usuarios(id),
    -- Apunta al PERFIL de técnico, así es imposible asignar un cliente como técnico
    tecnico_id         UUID REFERENCES identity.perfiles_tecnico(usuario_id),
    categoria_id       INT          NOT NULL REFERENCES orders.categorias_servicio(id),
    descripcion_falla  TEXT         NOT NULL,
    direccion          VARCHAR(255) NOT NULL,           -- el técnico necesita la dirección en texto
    referencia         VARCHAR(255),                    -- "portón verde, 2do piso"
    foto_evidencia_url TEXT,                            -- RF-07
    ubicacion_cliente  GEOGRAPHY(POINT, 4326) NOT NULL,
    estado             VARCHAR(20)  NOT NULL DEFAULT 'SOLICITADO',
    tarifa_urgencia    BOOLEAN      NOT NULL DEFAULT FALSE,   -- RF-26
    motivo_cancelacion TEXT,
    creado_en          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    asignado_en        TIMESTAMPTZ,
    finalizado_en      TIMESTAMPTZ,
    cancelado_en       TIMESTAMPTZ,
    actualizado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_orden_estado CHECK (
        estado IN ('SOLICITADO', 'EN_CAMINO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'FINALIZADO', 'CANCELADO')
    ),
    -- Pasada la fase "solicitado" tiene que haber un técnico asignado
    CONSTRAINT chk_orden_tecnico CHECK (estado IN ('SOLICITADO', 'CANCELADO') OR tecnico_id IS NOT NULL),
    -- Las fechas finales existen si y solo si el estado correspondiente
    CONSTRAINT chk_orden_fechas CHECK (
        ((estado = 'FINALIZADO') = (finalizado_en IS NOT NULL))
        AND ((estado = 'CANCELADO') = (cancelado_en IS NOT NULL))
    )
);

CREATE TRIGGER trg_ordenes_actualizado
    BEFORE UPDATE ON orders.ordenes_servicio
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE INDEX idx_ordenes_cliente ON orders.ordenes_servicio(cliente_id);
CREATE INDEX idx_ordenes_tecnico ON orders.ordenes_servicio(tecnico_id);
-- Índices parciales: solo indexan lo que se consulta de verdad (órdenes vivas)
CREATE INDEX idx_ordenes_activas ON orders.ordenes_servicio(estado)
    WHERE estado NOT IN ('FINALIZADO', 'CANCELADO');
CREATE INDEX idx_ordenes_pendientes_ubicacion ON orders.ordenes_servicio
    USING GIST (ubicacion_cliente) WHERE estado = 'SOLICITADO';

-- Historial de la máquina de estados (RF-08).
-- La REGLA de qué transiciones son válidas vive en el DOMINIO (Java), no aquí:
-- esta tabla solo deja constancia de lo que pasó.
CREATE TABLE orders.transiciones_estado (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id        UUID        NOT NULL REFERENCES orders.ordenes_servicio(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(20),
    estado_nuevo    VARCHAR(20) NOT NULL,
    registrado_por  UUID REFERENCES identity.usuarios(id),   -- quién hizo el cambio
    observacion     TEXT,
    registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_transicion_estados CHECK (
        estado_nuevo IN ('SOLICITADO', 'EN_CAMINO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'FINALIZADO', 'CANCELADO')
        AND (estado_anterior IS NULL OR estado_anterior IN
            ('SOLICITADO', 'EN_CAMINO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'FINALIZADO', 'CANCELADO'))
        AND estado_anterior IS DISTINCT FROM estado_nuevo
    )
);
CREATE INDEX idx_transiciones_orden ON orders.transiciones_estado(orden_id, registrado_en);

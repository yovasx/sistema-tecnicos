-- =============================================================================
-- V7: Módulos ADMIN (disputas) y NOTIFICATION (avisos, chat, push)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS admin;

CREATE TABLE admin.disputas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id         UUID        NOT NULL REFERENCES orders.ordenes_servicio(id),
    abierta_por      UUID        NOT NULL REFERENCES identity.usuarios(id),  -- antes "cliente_id": puede abrirla cualquiera de las partes
    motivo           TEXT        NOT NULL,
    estado           VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    resolucion       TEXT,
    administrador_id UUID REFERENCES identity.usuarios(id),
    abierta_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelta_en      TIMESTAMPTZ,
    CONSTRAINT chk_disputa_estado CHECK (estado IN ('ABIERTA', 'EN_REVISION', 'RESUELTA')),
    CONSTRAINT chk_disputa_resuelta CHECK (
        (estado = 'RESUELTA') = (resuelta_en IS NOT NULL)
        AND (estado <> 'RESUELTA' OR (resolucion IS NOT NULL AND administrador_id IS NOT NULL))
    )
);
CREATE INDEX idx_disputas_orden ON admin.disputas(orden_id);
CREATE INDEX idx_disputas_abiertas ON admin.disputas(estado) WHERE estado <> 'RESUELTA';

CREATE SCHEMA IF NOT EXISTS notification;

CREATE TABLE notification.notificaciones (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID        NOT NULL REFERENCES identity.usuarios(id) ON DELETE CASCADE,
    orden_id   UUID REFERENCES orders.ordenes_servicio(id) ON DELETE SET NULL,
    tipo       VARCHAR(30) NOT NULL,
    mensaje    TEXT        NOT NULL,
    leida      BOOLEAN     NOT NULL DEFAULT FALSE,
    enviado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_notificacion_tipo CHECK (tipo IN
        ('CAMBIO_ESTADO', 'TARIFA_URGENCIA', 'RECOTIZACION', 'PAGO', 'DISPUTA'))
);
-- Solo las no leídas (lo que la app consulta constantemente)
CREATE INDEX idx_notificaciones_no_leidas ON notification.notificaciones(usuario_id) WHERE NOT leida;

CREATE TABLE notification.mensajes_chat (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id   UUID        NOT NULL REFERENCES orders.ordenes_servicio(id) ON DELETE CASCADE,
    emisor_id  UUID        NOT NULL REFERENCES identity.usuarios(id),
    contenido  TEXT        NOT NULL CHECK (length(btrim(contenido)) > 0),
    enviado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_orden ON notification.mensajes_chat(orden_id, enviado_en);

-- Faltaba: sin tokens de dispositivo no hay notificaciones push (RF-25)
CREATE TABLE notification.dispositivos_push (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id    UUID        NOT NULL REFERENCES identity.usuarios(id) ON DELETE CASCADE,
    token         TEXT        NOT NULL UNIQUE,
    plataforma    VARCHAR(10) NOT NULL,
    activo        BOOLEAN     NOT NULL DEFAULT TRUE,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dispositivo_plataforma CHECK (plataforma IN ('ANDROID', 'IOS', 'WEB'))
);
CREATE INDEX idx_dispositivos_usuario ON notification.dispositivos_push(usuario_id);

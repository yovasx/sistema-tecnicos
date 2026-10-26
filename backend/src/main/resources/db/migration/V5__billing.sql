-- =============================================================================
-- V5: Módulo BILLING (cotizaciones, pagos, comisiones) — RF-14 a RF-17
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS billing;

-- Cada recotización es una NUEVA versión (queda historial y el cliente debe aceptarla)
CREATE TABLE billing.cotizaciones (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id      UUID          NOT NULL REFERENCES orders.ordenes_servicio(id) ON DELETE CASCADE,
    version       INT           NOT NULL DEFAULT 1,
    monto_total   NUMERIC(10,2) NOT NULL,
    moneda        CHAR(3)       NOT NULL DEFAULT 'BOB',
    motivo        TEXT,                                  -- por qué se recotiza (RF-15)
    estado        VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',
    creado_en     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    respondida_en TIMESTAMPTZ,
    CONSTRAINT uq_cotizacion_version UNIQUE (orden_id, version),
    CONSTRAINT chk_cotizacion_monto  CHECK (monto_total >= 0),
    CONSTRAINT chk_cotizacion_estado CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'REEMPLAZADA'))
);
-- Como máximo UNA cotización aceptada (la vigente) por orden
CREATE UNIQUE INDEX uq_cotizacion_vigente ON billing.cotizaciones(orden_id) WHERE estado = 'ACEPTADA';

-- Repuestos / trabajo adicional que justifica el monto (RF-15)
CREATE TABLE billing.items_cotizacion (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id UUID          NOT NULL REFERENCES billing.cotizaciones(id) ON DELETE CASCADE,
    descripcion   VARCHAR(200)  NOT NULL,
    monto         NUMERIC(10,2) NOT NULL CHECK (monto >= 0)
);
CREATE INDEX idx_items_cotizacion ON billing.items_cotizacion(cotizacion_id);

CREATE TABLE billing.comisiones (
    id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id  INT          NOT NULL REFERENCES orders.categorias_servicio(id),
    porcentaje    NUMERIC(5,2) NOT NULL CHECK (porcentaje BETWEEN 0 AND 100),
    vigente_desde DATE         NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uq_comision_vigencia UNIQUE (categoria_id, vigente_desde)
);

CREATE TABLE billing.pagos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orden_id            UUID          NOT NULL REFERENCES orders.ordenes_servicio(id),
    metodo              VARCHAR(20)   NOT NULL,
    monto               NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    moneda              CHAR(3)       NOT NULL DEFAULT 'BOB',
    -- "Foto" de la comisión al cobrar: si mañana cambia la tabla comisiones,
    -- los pagos históricos NO deben cambiar.
    comision_porcentaje NUMERIC(5,2)  CHECK (comision_porcentaje BETWEEN 0 AND 100),
    comision_monto      NUMERIC(10,2) CHECK (comision_monto >= 0),
    estado              VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',
    token_transaccion   VARCHAR(120)  UNIQUE,            -- evita procesar dos veces el mismo cobro
    comprobante_url     TEXT,                            -- RF-17
    creado_en           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    pagado_en           TIMESTAMPTZ,
    CONSTRAINT chk_pago_metodo CHECK (metodo IN ('TARJETA', 'QR', 'EFECTIVO')),
    CONSTRAINT chk_pago_estado CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'FALLIDO')),
    CONSTRAINT chk_pago_fecha  CHECK ((estado = 'CONFIRMADO') = (pagado_en IS NOT NULL))
);
CREATE INDEX idx_pagos_orden ON billing.pagos(orden_id);
-- Una orden no puede cobrarse dos veces
CREATE UNIQUE INDEX uq_pago_confirmado ON billing.pagos(orden_id) WHERE estado = 'CONFIRMADO';

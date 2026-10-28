-- =============================================================================
-- PLATAFORMA DE SERVICIOS TÉCNICOS A DOMICILIO INMEDIATO · VERSIÓN 2
-- PostgreSQL 14+ con PostGIS
--
-- Migración base v2. Reemplaza a las antiguas V1..V7 (squash) porque cambia
-- los IDs a BIGINT y reorganiza módulos. Se aplicó sobre una base limpia de
-- desarrollo. No editar una vez aplicada: los cambios futuros van en V2, V3...
--
-- Cambios principales respecto a la v1:
--   * IDs autoincrementales (BIGINT / INT IDENTITY) en lugar de UUID.
--   * Matching: tabla de ofertas + función de aceptación atómica.
--   * Chat propio (esquema chat): conversaciones, tipos de mensaje, leído/entregado,
--     mensajes de sistema, tarjeta de cotización y flag de moderación.
--   * Cotizaciones versionadas e inmutables, con estados, ítems y aceptación del cliente.
--   * Tarifas base (cotización inicial calculada desde la BD).
--   * Pagos ligados a la cotización aceptada + liquidaciones con snapshot de comisión
--     y deuda del técnico en pagos en efectivo.
--   * Máquina de estados validada por trigger (y regla: no hay reparación sin cotización aceptada).
--   * Cancelación con autor/motivo, auditoría de transiciones, soft delete, especialidades
--     normalizadas, particionado del historial de ubicaciones, etc.
--
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================================
-- 0. ESQUEMAS Y TIPOS
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS chat;
CREATE SCHEMA IF NOT EXISTS reputation;
CREATE SCHEMA IF NOT EXISTS admin_svc;
CREATE SCHEMA IF NOT EXISTS notification;

-- identity
CREATE TYPE identity.rol_usuario            AS ENUM ('cliente', 'tecnico', 'administrador');
CREATE TYPE identity.estado_validacion      AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE identity.estado_disponibilidad  AS ENUM ('fuera_servicio', 'disponible', 'ocupado');

-- orders
CREATE TYPE orders.estado_orden AS ENUM (
    'solicitado', 'en_camino', 'en_diagnostico', 'en_reparacion', 'finalizado', 'cancelado'
);
-- 'cerrada' = la orden la tomó otro técnico (no cuenta como rechazo ni expiración)
CREATE TYPE orders.estado_oferta AS ENUM ('enviada', 'aceptada', 'rechazada', 'expirada', 'cerrada');

-- billing
CREATE TYPE billing.metodo_pago        AS ENUM ('tarjeta', 'qr', 'efectivo');
CREATE TYPE billing.estado_pago        AS ENUM ('pendiente', 'confirmado', 'fallido');
CREATE TYPE billing.tipo_cotizacion    AS ENUM ('inicial', 'recotizacion');
CREATE TYPE billing.estado_cotizacion  AS ENUM ('borrador', 'enviada', 'aceptada', 'rechazada', 'expirada', 'reemplazada');
CREATE TYPE billing.tipo_item          AS ENUM ('visita', 'mano_obra', 'repuesto', 'desplazamiento', 'urgencia', 'otro');
CREATE TYPE billing.quien_cobra        AS ENUM ('plataforma', 'tecnico');
CREATE TYPE billing.estado_liquidacion AS ENUM (
    'pendiente_pago_tecnico',  -- la plataforma cobró y debe pagar al técnico
    'pagada_tecnico',          -- ya se pagó al técnico
    'por_cobrar_tecnico',      -- el técnico cobró en efectivo y debe la comisión
    'cobrada_tecnico'          -- la comisión ya fue recuperada
);

-- chat
CREATE TYPE chat.tipo_mensaje AS ENUM ('texto', 'imagen', 'sistema', 'cotizacion');

-- admin
CREATE TYPE admin_svc.estado_disputa AS ENUM ('abierta', 'en_revision', 'resuelta');

-- notification
CREATE TYPE notification.tipo_notificacion AS ENUM (
    'oferta_orden', 'cambio_estado', 'cotizacion_enviada', 'cotizacion_respondida',
    'tarifa_urgencia', 'mensaje_chat', 'pago', 'disputa', 'sistema'
);
CREATE TYPE notification.plataforma_dispositivo AS ENUM ('android', 'ios', 'web');

-- Función genérica para mantener actualizado_en
CREATE OR REPLACE FUNCTION public.fn_set_actualizado_en() RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. IDENTITY
-- =============================================================================
CREATE TABLE identity.usuarios (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol              identity.rol_usuario NOT NULL,
    nombre           VARCHAR(100) NOT NULL,
    apellido         VARCHAR(100) NOT NULL,
    email            VARCHAR(150) NOT NULL,
    telefono         VARCHAR(20),
    password_hash    VARCHAR(255) NOT NULL,            -- BCrypt (RNF-07)
    foto_perfil_url  TEXT,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    eliminado_en     TIMESTAMPTZ,                       -- borrado lógico
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email único solo entre usuarios no eliminados (y sin distinguir mayúsculas)
CREATE UNIQUE INDEX uq_usuarios_email ON identity.usuarios (lower(email)) WHERE eliminado_en IS NULL;
CREATE INDEX idx_usuarios_rol ON identity.usuarios(rol);

CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON identity.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_actualizado_en();

-- Catálogo de categorías (vive en orders pero lo usan identity, billing, etc.)
CREATE TABLE orders.categorias_servicio (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(80) NOT NULL UNIQUE,
    descripcion  TEXT,
    activa       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE identity.perfiles_tecnico (
    usuario_id              BIGINT PRIMARY KEY REFERENCES identity.usuarios(id),
    documento_identidad_url TEXT,
    certificaciones_url     TEXT[],
    estado_validacion       identity.estado_validacion NOT NULL DEFAULT 'pendiente',
    validado_por            BIGINT REFERENCES identity.usuarios(id),
    fecha_validacion        TIMESTAMPTZ,
    disponibilidad          identity.estado_disponibilidad NOT NULL DEFAULT 'fuera_servicio'
);

-- Especialidades normalizadas (reemplaza TEXT[] libre)
CREATE TABLE identity.tecnico_especialidades (
    tecnico_id   BIGINT NOT NULL REFERENCES identity.perfiles_tecnico(usuario_id),
    categoria_id INT    NOT NULL REFERENCES orders.categorias_servicio(id),
    PRIMARY KEY (tecnico_id, categoria_id)
);
CREATE INDEX idx_esp_categoria ON identity.tecnico_especialidades(categoria_id);
CREATE INDEX idx_perfiles_disponibles ON identity.perfiles_tecnico(usuario_id)
    WHERE disponibilidad = 'disponible' AND estado_validacion = 'aprobado';

-- =============================================================================
-- 2. ORDERS
-- =============================================================================
CREATE TABLE orders.ordenes_servicio (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id            BIGINT NOT NULL REFERENCES identity.usuarios(id),
    tecnico_id            BIGINT REFERENCES identity.usuarios(id),
    categoria_id          INT    NOT NULL REFERENCES orders.categorias_servicio(id),
    descripcion_falla     TEXT   NOT NULL,
    foto_evidencia_url    TEXT,
    ubicacion_cliente     GEOGRAPHY(POINT, 4326) NOT NULL,
    direccion_referencia  TEXT,
    estado                orders.estado_orden NOT NULL DEFAULT 'solicitado',
    tarifa_urgencia       BOOLEAN NOT NULL DEFAULT FALSE,
    -- cancelación
    cancelado_por         BIGINT REFERENCES identity.usuarios(id),
    motivo_cancelacion    TEXT,
    cancelado_en          TIMESTAMPTZ,
    -- tiempos
    creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
    asignado_en           TIMESTAMPTZ,
    llegada_estimada_en   TIMESTAMPTZ,      -- la fija la app al asignar (para puntualidad)
    llegada_en            TIMESTAMPTZ,      -- se llena al pasar a 'en_diagnostico'
    finalizado_en         TIMESTAMPTZ,
    actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (tecnico_id IS NULL OR tecnico_id <> cliente_id),
    CHECK (estado <> 'cancelado' OR cancelado_en IS NOT NULL)
);

CREATE INDEX idx_ordenes_cliente   ON orders.ordenes_servicio(cliente_id);
CREATE INDEX idx_ordenes_tecnico   ON orders.ordenes_servicio(tecnico_id);
CREATE INDEX idx_ordenes_estado    ON orders.ordenes_servicio(estado);
CREATE INDEX idx_ordenes_ubicacion ON orders.ordenes_servicio USING GIST (ubicacion_cliente);

-- Ofertas de la orden a técnicos (proceso de matching)
CREATE TABLE orders.ofertas_orden (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id          BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id) ON DELETE CASCADE,
    tecnico_id        BIGINT NOT NULL REFERENCES identity.usuarios(id),
    estado            orders.estado_oferta NOT NULL DEFAULT 'enviada',
    distancia_metros  NUMERIC(10,2),
    motivo_rechazo    TEXT,
    enviada_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en         TIMESTAMPTZ NOT NULL,
    respondida_en     TIMESTAMPTZ,
    UNIQUE (orden_id, tecnico_id),
    CHECK (expira_en > enviada_en)
);
-- Garantiza que una orden tenga como máximo UNA oferta aceptada
CREATE UNIQUE INDEX uq_oferta_aceptada ON orders.ofertas_orden(orden_id) WHERE estado = 'aceptada';
CREATE INDEX idx_ofertas_tecnico_pend ON orders.ofertas_orden(tecnico_id) WHERE estado = 'enviada';
CREATE INDEX idx_ofertas_expiracion   ON orders.ofertas_orden(expira_en)  WHERE estado = 'enviada';

-- Transiciones permitidas de la máquina de estados (datos, no código)
CREATE TABLE orders.transiciones_permitidas (
    estado_origen  orders.estado_orden NOT NULL,
    estado_destino orders.estado_orden NOT NULL,
    PRIMARY KEY (estado_origen, estado_destino)
);

-- Historial / auditoría de transiciones
CREATE TABLE orders.transiciones_estado (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id        BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id) ON DELETE CASCADE,
    estado_anterior orders.estado_orden,
    estado_nuevo    orders.estado_orden NOT NULL,
    usuario_id      BIGINT REFERENCES identity.usuarios(id),   -- quién la hizo (NULL = sistema)
    observacion     TEXT,
    registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transiciones_orden ON orders.transiciones_estado(orden_id, registrado_en);

-- =============================================================================
-- 3. GEO
-- =============================================================================
CREATE TABLE geo.zonas_cobertura (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tecnico_id    BIGINT NOT NULL REFERENCES identity.usuarios(id),
    nombre_zona   VARCHAR(100),
    poligono      GEOGRAPHY(POLYGON, 4326) NOT NULL,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_zonas_poligono ON geo.zonas_cobertura USING GIST (poligono);
CREATE INDEX idx_zonas_tecnico  ON geo.zonas_cobertura(tecnico_id);

-- Última posición conocida de cada técnico (1 fila por técnico, se hace UPSERT)
CREATE TABLE geo.ubicacion_actual (
    tecnico_id      BIGINT PRIMARY KEY REFERENCES identity.usuarios(id),
    punto           GEOGRAPHY(POINT, 4326) NOT NULL,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ubicacion_actual_punto ON geo.ubicacion_actual USING GIST (punto);

-- Historial de ubicaciones, particionado por mes. Guardar SOLO durante órdenes activas.
CREATE TABLE geo.ubicaciones_historial (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    tecnico_id    BIGINT NOT NULL REFERENCES identity.usuarios(id),
    orden_id      BIGINT REFERENCES orders.ordenes_servicio(id),
    punto         GEOGRAPHY(POINT, 4326) NOT NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, registrado_en)
) PARTITION BY RANGE (registrado_en);

CREATE INDEX idx_ubic_hist_tecnico ON geo.ubicaciones_historial(tecnico_id, registrado_en DESC);
CREATE INDEX idx_ubic_hist_orden   ON geo.ubicaciones_historial(orden_id, registrado_en);

CREATE OR REPLACE FUNCTION geo.crear_particion_ubicaciones(p_mes DATE) RETURNS TEXT AS $$
DECLARE
    v_inicio DATE := date_trunc('month', p_mes)::date;
    v_fin    DATE := (date_trunc('month', p_mes) + INTERVAL '1 month')::date;
    v_nombre TEXT := format('ubicaciones_historial_%s', to_char(v_inicio, 'YYYY_MM'));
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS geo.%I PARTITION OF geo.ubicaciones_historial FOR VALUES FROM (%L) TO (%L)',
        v_nombre, v_inicio, v_fin);
    RETURN v_nombre;
END $$ LANGUAGE plpgsql;

-- Crea el mes actual y los 2 siguientes (programar mensualmente con pg_cron o un job)
SELECT geo.crear_particion_ubicaciones((CURRENT_DATE + make_interval(months => n))::date)
FROM generate_series(0, 2) AS n;

-- =============================================================================
-- 4. BILLING
-- =============================================================================
-- Tarifas base: alimentan la cotización inicial
CREATE TABLE billing.tarifas (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id          INT NOT NULL REFERENCES orders.categorias_servicio(id),
    tarifa_visita         NUMERIC(10,2) NOT NULL CHECK (tarifa_visita >= 0),
    tarifa_hora           NUMERIC(10,2) CHECK (tarifa_hora >= 0),
    recargo_urgencia_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (recargo_urgencia_pct BETWEEN 0 AND 100),
    moneda                CHAR(3) NOT NULL DEFAULT 'BOB',
    vigente_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta         DATE,
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE INDEX idx_tarifas_categoria ON billing.tarifas(categoria_id, vigente_desde DESC);

-- Cotizaciones versionadas: NUNCA se editan una vez enviadas; se crea una nueva versión
CREATE TABLE billing.cotizaciones (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id        BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    version         INT NOT NULL,                       -- se asigna automáticamente
    tipo            billing.tipo_cotizacion NOT NULL,   -- se deduce de la versión
    estado          billing.estado_cotizacion NOT NULL DEFAULT 'borrador',
    motivo          TEXT,                               -- obligatorio en recotizaciones
    total           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),  -- calculado por trigger desde los ítems
    moneda          CHAR(3) NOT NULL DEFAULT 'BOB',
    creada_por      BIGINT REFERENCES identity.usuarios(id),              -- NULL = sistema
    creada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviada_en      TIMESTAMPTZ,
    expira_en       TIMESTAMPTZ,
    respondida_en   TIMESTAMPTZ,
    motivo_rechazo  TEXT,
    UNIQUE (orden_id, version),
    CHECK (tipo = 'inicial' OR motivo IS NOT NULL)
);
-- Una sola cotización vigente (aceptada) por orden
CREATE UNIQUE INDEX uq_cotizacion_aceptada ON billing.cotizaciones(orden_id) WHERE estado = 'aceptada';
CREATE INDEX idx_cotizaciones_orden ON billing.cotizaciones(orden_id);
CREATE INDEX idx_cotizaciones_expira ON billing.cotizaciones(expira_en) WHERE estado = 'enviada';

CREATE TABLE billing.cotizacion_items (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cotizacion_id    BIGINT NOT NULL REFERENCES billing.cotizaciones(id) ON DELETE CASCADE,
    tipo             billing.tipo_item NOT NULL,
    descripcion      VARCHAR(200) NOT NULL,
    cantidad         NUMERIC(8,2)  NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal         NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(cantidad * precio_unitario, 2)) STORED
);
CREATE INDEX idx_items_cotizacion ON billing.cotizacion_items(cotizacion_id);

CREATE TABLE billing.pagos (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id          BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    cotizacion_id     BIGINT NOT NULL REFERENCES billing.cotizaciones(id),   -- la aceptada que se paga
    metodo            billing.metodo_pago NOT NULL,
    monto             NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    estado            billing.estado_pago NOT NULL DEFAULT 'pendiente',
    token_transaccion VARCHAR(120),            -- tokenización del proveedor (RNF-09)
    comprobante_url   TEXT,                    -- RF-17
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    pagado_en         TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_pago_confirmado ON billing.pagos(orden_id) WHERE estado = 'confirmado';
CREATE INDEX idx_pagos_orden ON billing.pagos(orden_id);

-- Comisiones por categoría con vigencia (histórico)
CREATE TABLE billing.comisiones (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id    INT NOT NULL REFERENCES orders.categorias_servicio(id),
    porcentaje      NUMERIC(5,2) NOT NULL CHECK (porcentaje BETWEEN 0 AND 100),
    vigente_desde   DATE NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta   DATE,
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE INDEX idx_comisiones_categoria ON billing.comisiones(categoria_id, vigente_desde DESC);

-- Liquidación por pago: guarda el SNAPSHOT del porcentaje aplicado
CREATE TABLE billing.liquidaciones (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pago_id          BIGINT NOT NULL UNIQUE REFERENCES billing.pagos(id),
    orden_id         BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    tecnico_id       BIGINT NOT NULL REFERENCES identity.usuarios(id),
    monto_bruto      NUMERIC(12,2) NOT NULL,
    comision_pct     NUMERIC(5,2)  NOT NULL,
    comision_monto   NUMERIC(12,2) NOT NULL,
    neto_tecnico     NUMERIC(12,2) NOT NULL,
    cobrado_por      billing.quien_cobra NOT NULL,
    estado           billing.estado_liquidacion NOT NULL,
    creada_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    liquidada_en     TIMESTAMPTZ,
    CHECK (monto_bruto = comision_monto + neto_tecnico)
);
CREATE INDEX idx_liq_tecnico_estado ON billing.liquidaciones(tecnico_id, estado);

-- =============================================================================
-- 5. CHAT
-- =============================================================================
CREATE TABLE chat.conversaciones (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id    BIGINT NOT NULL UNIQUE REFERENCES orders.ordenes_servicio(id),
    cliente_id  BIGINT NOT NULL REFERENCES identity.usuarios(id),
    tecnico_id  BIGINT NOT NULL REFERENCES identity.usuarios(id),
    abierta     BOOLEAN NOT NULL DEFAULT TRUE,
    creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    cerrada_en  TIMESTAMPTZ
);
CREATE INDEX idx_conv_cliente ON chat.conversaciones(cliente_id);
CREATE INDEX idx_conv_tecnico ON chat.conversaciones(tecnico_id);

CREATE TABLE chat.mensajes (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversacion_id    BIGINT NOT NULL REFERENCES chat.conversaciones(id),
    emisor_id          BIGINT REFERENCES identity.usuarios(id),    -- NULL solo en mensajes de sistema
    tipo               chat.tipo_mensaje NOT NULL DEFAULT 'texto',
    contenido          TEXT,
    adjunto_url        TEXT,
    cotizacion_id      BIGINT REFERENCES billing.cotizaciones(id),  -- tarjeta de cotización en el chat
    contiene_contacto  BOOLEAN NOT NULL DEFAULT FALSE,              -- moderación: teléfono/email detectado
    enviado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    entregado_en       TIMESTAMPTZ,
    leido_en           TIMESTAMPTZ,
    CHECK (tipo = 'sistema' OR emisor_id IS NOT NULL),
    CHECK (tipo <> 'texto'      OR contenido IS NOT NULL),
    CHECK (tipo <> 'imagen'     OR adjunto_url IS NOT NULL),
    CHECK (tipo <> 'cotizacion' OR cotizacion_id IS NOT NULL)
);
CREATE INDEX idx_mensajes_conv ON chat.mensajes(conversacion_id, id);
CREATE INDEX idx_mensajes_no_leidos ON chat.mensajes(conversacion_id) WHERE leido_en IS NULL;
CREATE INDEX idx_mensajes_moderacion ON chat.mensajes(id) WHERE contiene_contacto;

-- =============================================================================
-- 6. REPUTATION
-- =============================================================================
CREATE TABLE reputation.calificaciones (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id        BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    calificador_id  BIGINT NOT NULL REFERENCES identity.usuarios(id),
    calificado_id   BIGINT NOT NULL REFERENCES identity.usuarios(id),
    puntaje         SMALLINT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario      TEXT,
    registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (orden_id, calificador_id),
    CHECK (calificador_id <> calificado_id)
);
CREATE INDEX idx_calif_calificado ON reputation.calificaciones(calificado_id);

-- Calculado por reputation.recalcular_indice(); no se edita a mano
CREATE TABLE reputation.indices_reputacion (
    tecnico_id             BIGINT PRIMARY KEY REFERENCES identity.usuarios(id),
    tasa_resolucion        NUMERIC(5,2) NOT NULL DEFAULT 0,
    puntualidad            NUMERIC(5,2) NOT NULL DEFAULT 0,
    tasa_aceptacion        NUMERIC(5,2) NOT NULL DEFAULT 0,
    calificacion_promedio  NUMERIC(3,2) NOT NULL DEFAULT 0,
    indice_general         NUMERIC(5,2) NOT NULL DEFAULT 0,   -- usado para priorizar (RF-20)
    formula_version        SMALLINT NOT NULL DEFAULT 1,
    actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. ADMIN
-- =============================================================================
CREATE TABLE admin_svc.disputas (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id            BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    abierta_por_id      BIGINT NOT NULL REFERENCES identity.usuarios(id),   -- cliente O técnico
    contra_usuario_id   BIGINT NOT NULL REFERENCES identity.usuarios(id),
    motivo              TEXT NOT NULL,
    estado              admin_svc.estado_disputa NOT NULL DEFAULT 'abierta',
    resolucion          TEXT,
    administrador_id    BIGINT REFERENCES identity.usuarios(id),
    abierta_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelta_en         TIMESTAMPTZ,
    CHECK (abierta_por_id <> contra_usuario_id),
    CHECK (estado <> 'resuelta' OR (resolucion IS NOT NULL AND resuelta_en IS NOT NULL))
);
CREATE INDEX idx_disputas_estado ON admin_svc.disputas(estado);
CREATE INDEX idx_disputas_orden  ON admin_svc.disputas(orden_id);

CREATE TABLE admin_svc.disputa_evidencias (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    disputa_id   BIGINT NOT NULL REFERENCES admin_svc.disputas(id) ON DELETE CASCADE,
    subido_por   BIGINT NOT NULL REFERENCES identity.usuarios(id),
    url          TEXT NOT NULL,
    descripcion  TEXT,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidencias_disputa ON admin_svc.disputa_evidencias(disputa_id);

-- =============================================================================
-- 8. NOTIFICATION
-- =============================================================================
CREATE TABLE notification.notificaciones (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  BIGINT NOT NULL REFERENCES identity.usuarios(id),
    orden_id    BIGINT REFERENCES orders.ordenes_servicio(id),
    tipo        notification.tipo_notificacion NOT NULL,
    mensaje     TEXT NOT NULL,
    leido       BOOLEAN NOT NULL DEFAULT FALSE,
    enviado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_usuario ON notification.notificaciones(usuario_id, leido, enviado_en DESC);

-- Tokens push (FCM / APNs)
CREATE TABLE notification.dispositivos (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  BIGINT NOT NULL REFERENCES identity.usuarios(id),
    plataforma  notification.plataforma_dispositivo NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispositivos_usuario ON notification.dispositivos(usuario_id) WHERE activo;

-- =============================================================================
-- 9. LÓGICA DE NEGOCIO: FUNCIONES Y TRIGGERS
-- =============================================================================

-- La app debe ejecutar al inicio de cada transacción:
--     SELECT set_config('app.usuario_id', '<id_usuario>', true);
-- para que la auditoría sepa quién hizo cada cambio.
CREATE OR REPLACE FUNCTION orders.usuario_actual() RETURNS BIGINT AS $$
    SELECT NULLIF(current_setting('app.usuario_id', true), '')::BIGINT;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- 9.1 ORDENES: validación de la máquina de estados
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION orders.fn_validar_orden() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
        IF NOT EXISTS (SELECT 1 FROM orders.transiciones_permitidas
                       WHERE estado_origen = OLD.estado AND estado_destino = NEW.estado) THEN
            RAISE EXCEPTION 'Transición no permitida: % -> %', OLD.estado, NEW.estado;
        END IF;

        IF NEW.estado IN ('en_camino', 'en_diagnostico', 'en_reparacion', 'finalizado')
           AND NEW.tecnico_id IS NULL THEN
            RAISE EXCEPTION 'No se puede pasar a % sin técnico asignado', NEW.estado;
        END IF;

        -- Regla clave: no hay reparación sin una cotización aceptada por el cliente
        IF NEW.estado = 'en_reparacion' AND NOT EXISTS (
               SELECT 1 FROM billing.cotizaciones
               WHERE orden_id = NEW.id AND estado = 'aceptada') THEN
            RAISE EXCEPTION 'No se puede iniciar la reparación sin una cotización aceptada';
        END IF;

        IF NEW.estado = 'en_diagnostico' AND NEW.llegada_en IS NULL THEN
            NEW.llegada_en := now();
        END IF;
        IF NEW.estado = 'finalizado' THEN
            NEW.finalizado_en := COALESCE(NEW.finalizado_en, now());
        END IF;
        IF NEW.estado = 'cancelado' THEN
            NEW.cancelado_en := COALESCE(NEW.cancelado_en, now());
            NEW.cancelado_por := COALESCE(NEW.cancelado_por, orders.usuario_actual());
            IF NEW.motivo_cancelacion IS NULL THEN
                RAISE EXCEPTION 'Debe indicar el motivo de la cancelación';
            END IF;
        END IF;
    END IF;

    IF NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id AND OLD.tecnico_id IS NOT NULL THEN
        RAISE EXCEPTION 'Reasignar técnico requiere cancelar y crear una nueva orden/oferta';
    END IF;
    IF NEW.tecnico_id IS NOT NULL AND OLD.tecnico_id IS NULL AND NEW.asignado_en IS NULL THEN
        NEW.asignado_en := now();
    END IF;

    NEW.actualizado_en := now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orden_validar
    BEFORE UPDATE ON orders.ordenes_servicio
    FOR EACH ROW EXECUTE FUNCTION orders.fn_validar_orden();

-- Historial de transiciones (alta + cambios de estado)
CREATE OR REPLACE FUNCTION orders.fn_registrar_transicion() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO orders.transiciones_estado (orden_id, estado_anterior, estado_nuevo, usuario_id)
        VALUES (NEW.id, NULL, NEW.estado, orders.usuario_actual());
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
        INSERT INTO orders.transiciones_estado (orden_id, estado_anterior, estado_nuevo, usuario_id, observacion)
        VALUES (NEW.id, OLD.estado, NEW.estado, orders.usuario_actual(), NEW.motivo_cancelacion);
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orden_historial_ins AFTER INSERT ON orders.ordenes_servicio
    FOR EACH ROW EXECUTE FUNCTION orders.fn_registrar_transicion();
CREATE TRIGGER trg_orden_historial_upd AFTER UPDATE OF estado ON orders.ordenes_servicio
    FOR EACH ROW EXECUTE FUNCTION orders.fn_registrar_transicion();

-- Al asignar técnico: se abre la conversación de chat
-- (el nombre empieza con 'a' para ejecutarse antes que trg_orden_efectos_estado)
CREATE OR REPLACE FUNCTION orders.fn_orden_asignada() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO chat.conversaciones (orden_id, cliente_id, tecnico_id)
    VALUES (NEW.id, NEW.cliente_id, NEW.tecnico_id)
    ON CONFLICT (orden_id) DO NOTHING;

    INSERT INTO chat.mensajes (conversacion_id, emisor_id, tipo, contenido)
    SELECT c.id, NULL, 'sistema', 'Se asignó un técnico a tu solicitud.'
    FROM chat.conversaciones c WHERE c.orden_id = NEW.id;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orden_asignacion
    AFTER UPDATE OF tecnico_id ON orders.ordenes_servicio
    FOR EACH ROW WHEN (OLD.tecnico_id IS NULL AND NEW.tecnico_id IS NOT NULL)
    EXECUTE FUNCTION orders.fn_orden_asignada();

-- Efectos de un cambio de estado: mensaje de sistema, notificaciones, disponibilidad, reputación
CREATE OR REPLACE FUNCTION orders.fn_orden_efectos_estado() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO chat.mensajes (conversacion_id, emisor_id, tipo, contenido)
    SELECT c.id, NULL, 'sistema', format('Estado de la orden: %s', NEW.estado)
    FROM chat.conversaciones c WHERE c.orden_id = NEW.id AND c.abierta;

    INSERT INTO notification.notificaciones (usuario_id, orden_id, tipo, mensaje)
    VALUES (NEW.cliente_id, NEW.id, 'cambio_estado', format('Tu orden #%s cambió a: %s', NEW.id, NEW.estado));

    IF NEW.estado = 'cancelado' AND NEW.tecnico_id IS NOT NULL THEN
        INSERT INTO notification.notificaciones (usuario_id, orden_id, tipo, mensaje)
        VALUES (NEW.tecnico_id, NEW.id, 'cambio_estado', format('La orden #%s fue cancelada', NEW.id));
    END IF;

    IF NEW.estado IN ('finalizado', 'cancelado') THEN
        UPDATE chat.conversaciones SET abierta = FALSE, cerrada_en = now()
        WHERE orden_id = NEW.id AND abierta;

        IF NEW.tecnico_id IS NOT NULL THEN
            UPDATE identity.perfiles_tecnico SET disponibilidad = 'disponible'
            WHERE usuario_id = NEW.tecnico_id AND disponibilidad = 'ocupado';
            PERFORM reputation.recalcular_indice(NEW.tecnico_id);
        END IF;
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orden_efectos_estado
    AFTER UPDATE OF estado ON orders.ordenes_servicio
    FOR EACH ROW WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION orders.fn_orden_efectos_estado();

-- ---------------------------------------------------------------------------
-- 9.2 MATCHING: aceptación atómica de una oferta
-- ---------------------------------------------------------------------------
-- Devuelve TRUE si el técnico se quedó con la orden; FALSE si otro llegó antes o la oferta expiró.
CREATE OR REPLACE FUNCTION orders.aceptar_oferta(p_oferta_id BIGINT, p_tecnico_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_orden_id BIGINT;
    v_filas    INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM identity.usuarios u
        JOIN identity.perfiles_tecnico p ON p.usuario_id = u.id
        WHERE u.id = p_tecnico_id AND u.rol = 'tecnico' AND u.activo
          AND u.eliminado_en IS NULL AND p.estado_validacion = 'aprobado') THEN
        RAISE EXCEPTION 'El técnico no está habilitado para aceptar órdenes';
    END IF;

    PERFORM set_config('app.usuario_id', p_tecnico_id::text, true);

    SELECT orden_id INTO v_orden_id
    FROM orders.ofertas_orden
    WHERE id = p_oferta_id AND tecnico_id = p_tecnico_id
      AND estado = 'enviada' AND expira_en > now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- UPDATE condicional: solo uno gana aunque lleguen dos aceptaciones simultáneas
    UPDATE orders.ordenes_servicio
       SET tecnico_id = p_tecnico_id, estado = 'en_camino'
     WHERE id = v_orden_id AND tecnico_id IS NULL AND estado = 'solicitado';
    GET DIAGNOSTICS v_filas = ROW_COUNT;

    IF v_filas = 0 THEN
        UPDATE orders.ofertas_orden SET estado = 'cerrada', respondida_en = now() WHERE id = p_oferta_id;
        RETURN FALSE;
    END IF;

    UPDATE orders.ofertas_orden SET estado = 'aceptada', respondida_en = now() WHERE id = p_oferta_id;
    UPDATE orders.ofertas_orden SET estado = 'cerrada',  respondida_en = now()
     WHERE orden_id = v_orden_id AND id <> p_oferta_id AND estado = 'enviada';
    UPDATE identity.perfiles_tecnico SET disponibilidad = 'ocupado' WHERE usuario_id = p_tecnico_id;
    RETURN TRUE;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION orders.rechazar_oferta(p_oferta_id BIGINT, p_tecnico_id BIGINT, p_motivo TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    UPDATE orders.ofertas_orden
       SET estado = 'rechazada', motivo_rechazo = p_motivo, respondida_en = now()
     WHERE id = p_oferta_id AND tecnico_id = p_tecnico_id AND estado = 'enviada';
END $$ LANGUAGE plpgsql;

-- Ejecutar periódicamente (pg_cron cada 30 s o desde la app)
CREATE OR REPLACE FUNCTION orders.expirar_ofertas() RETURNS INT AS $$
DECLARE v_n INT;
BEGIN
    UPDATE orders.ofertas_orden SET estado = 'expirada', respondida_en = now()
     WHERE estado = 'enviada' AND expira_en <= now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 9.3 COTIZACIONES
-- ---------------------------------------------------------------------------
-- Versión y tipo automáticos
CREATE OR REPLACE FUNCTION billing.fn_cotizacion_version() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.version IS NULL THEN
        SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
        FROM billing.cotizaciones WHERE orden_id = NEW.orden_id;
    END IF;
    IF NEW.tipo IS NULL THEN
        NEW.tipo := CASE WHEN NEW.version = 1 THEN 'inicial' ELSE 'recotizacion' END;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cotizacion_version
    BEFORE INSERT ON billing.cotizaciones
    FOR EACH ROW EXECUTE FUNCTION billing.fn_cotizacion_version();

-- Inmutabilidad y transiciones válidas
CREATE OR REPLACE FUNCTION billing.fn_cotizacion_guard() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.estado <> 'borrador' THEN
            RAISE EXCEPTION 'Solo se pueden eliminar cotizaciones en borrador';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.estado <> 'borrador' AND
       (NEW.total <> OLD.total OR NEW.orden_id <> OLD.orden_id OR NEW.version <> OLD.version) THEN
        RAISE EXCEPTION 'Una cotización enviada no se puede modificar; cree una nueva versión';
    END IF;

    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
        IF NOT (
               (OLD.estado = 'borrador' AND NEW.estado = 'enviada')
            OR (OLD.estado = 'enviada'  AND NEW.estado IN ('aceptada', 'rechazada', 'expirada', 'reemplazada'))
            OR (OLD.estado = 'aceptada' AND NEW.estado = 'reemplazada')
        ) THEN
            RAISE EXCEPTION 'Transición de cotización no permitida: % -> %', OLD.estado, NEW.estado;
        END IF;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cotizacion_guard
    BEFORE UPDATE OR DELETE ON billing.cotizaciones
    FOR EACH ROW EXECUTE FUNCTION billing.fn_cotizacion_guard();

-- Los ítems solo se tocan en borrador
CREATE OR REPLACE FUNCTION billing.fn_items_guard() RETURNS TRIGGER AS $$
DECLARE v_estado billing.estado_cotizacion;
BEGIN
    SELECT estado INTO v_estado FROM billing.cotizaciones
    WHERE id = COALESCE(NEW.cotizacion_id, OLD.cotizacion_id);
    IF v_estado IS NOT NULL AND v_estado <> 'borrador' THEN
        RAISE EXCEPTION 'No se pueden modificar ítems de una cotización que no está en borrador';
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_items_guard
    BEFORE INSERT OR UPDATE OR DELETE ON billing.cotizacion_items
    FOR EACH ROW EXECUTE FUNCTION billing.fn_items_guard();

-- El total se recalcula siempre desde los ítems (nunca queda inconsistente)
CREATE OR REPLACE FUNCTION billing.fn_items_recalcular() RETURNS TRIGGER AS $$
DECLARE v_id BIGINT := COALESCE(NEW.cotizacion_id, OLD.cotizacion_id);
BEGIN
    UPDATE billing.cotizaciones
       SET total = COALESCE((SELECT SUM(subtotal) FROM billing.cotizacion_items WHERE cotizacion_id = v_id), 0)
     WHERE id = v_id;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_items_recalcular
    AFTER INSERT OR UPDATE OR DELETE ON billing.cotizacion_items
    FOR EACH ROW EXECUTE FUNCTION billing.fn_items_recalcular();

-- Cotización inicial calculada desde las tarifas base. Queda 'aceptada' porque el
-- cliente confirma el estimado al solicitar el servicio.
CREATE OR REPLACE FUNCTION billing.generar_cotizacion_inicial(p_orden_id BIGINT) RETURNS BIGINT AS $$
DECLARE
    v_orden  orders.ordenes_servicio%ROWTYPE;
    v_tarifa billing.tarifas%ROWTYPE;
    v_cot_id BIGINT;
BEGIN
    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id = p_orden_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Orden % no existe', p_orden_id; END IF;

    SELECT * INTO v_tarifa FROM billing.tarifas
     WHERE categoria_id = v_orden.categoria_id
       AND vigente_desde <= CURRENT_DATE
       AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
     ORDER BY vigente_desde DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'No hay tarifa vigente para la categoría %', v_orden.categoria_id; END IF;

    INSERT INTO billing.cotizaciones (orden_id, moneda, creada_por)
    VALUES (p_orden_id, v_tarifa.moneda, NULL)
    RETURNING id INTO v_cot_id;

    INSERT INTO billing.cotizacion_items (cotizacion_id, tipo, descripcion, cantidad, precio_unitario)
    VALUES (v_cot_id, 'visita', 'Visita técnica y diagnóstico', 1, v_tarifa.tarifa_visita);

    IF v_orden.tarifa_urgencia AND v_tarifa.recargo_urgencia_pct > 0 THEN
        INSERT INTO billing.cotizacion_items (cotizacion_id, tipo, descripcion, cantidad, precio_unitario)
        VALUES (v_cot_id, 'urgencia', 'Recargo por servicio urgente', 1,
                ROUND(v_tarifa.tarifa_visita * v_tarifa.recargo_urgencia_pct / 100, 2));
    END IF;

    UPDATE billing.cotizaciones SET estado = 'enviada',  enviada_en = now()                     WHERE id = v_cot_id;
    UPDATE billing.cotizaciones SET estado = 'aceptada', respondida_en = now()                  WHERE id = v_cot_id;
    RETURN v_cot_id;
END $$ LANGUAGE plpgsql;

-- El técnico envía una cotización (borrador -> enviada). Aparece como tarjeta en el chat.
CREATE OR REPLACE FUNCTION billing.enviar_cotizacion(p_cotizacion_id BIGINT, p_tecnico_id BIGINT,
                                                     p_minutos_validez INT DEFAULT 15)
RETURNS VOID AS $$
DECLARE
    v_cot     billing.cotizaciones%ROWTYPE;
    v_orden   orders.ordenes_servicio%ROWTYPE;
BEGIN
    SELECT * INTO v_cot FROM billing.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no existe'; END IF;
    IF v_cot.estado <> 'borrador' THEN RAISE EXCEPTION 'Solo se puede enviar una cotización en borrador'; END IF;
    IF v_cot.total <= 0 THEN RAISE EXCEPTION 'La cotización no tiene ítems'; END IF;

    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id = v_cot.orden_id;
    IF v_orden.tecnico_id IS DISTINCT FROM p_tecnico_id THEN
        RAISE EXCEPTION 'Solo el técnico asignado puede enviar cotizaciones de esta orden';
    END IF;
    IF v_orden.estado NOT IN ('en_diagnostico', 'en_reparacion') THEN
        RAISE EXCEPTION 'Solo se puede recotizar durante el diagnóstico o la reparación';
    END IF;

    -- Otra cotización enviada y sin responder queda reemplazada (la aceptada sigue vigente hasta que el cliente acepte esta)
    UPDATE billing.cotizaciones SET estado = 'reemplazada'
     WHERE orden_id = v_cot.orden_id AND estado = 'enviada' AND id <> p_cotizacion_id;

    UPDATE billing.cotizaciones
       SET estado = 'enviada', enviada_en = now(),
           expira_en = now() + make_interval(mins => p_minutos_validez)
     WHERE id = p_cotizacion_id;

    INSERT INTO chat.mensajes (conversacion_id, emisor_id, tipo, contenido, cotizacion_id)
    SELECT c.id, p_tecnico_id, 'cotizacion',
           format('Nueva cotización v%s por %s %s', v_cot.version, v_cot.total, v_cot.moneda), p_cotizacion_id
    FROM chat.conversaciones c WHERE c.orden_id = v_cot.orden_id AND c.abierta;

    INSERT INTO notification.notificaciones (usuario_id, orden_id, tipo, mensaje)
    VALUES (v_orden.cliente_id, v_orden.id, 'cotizacion_enviada',
            format('El técnico te envió una nueva cotización: %s %s', v_cot.total, v_cot.moneda));
END $$ LANGUAGE plpgsql;

-- El cliente acepta o rechaza. Devuelve el estado resultante ('aceptada','rechazada','expirada').
CREATE OR REPLACE FUNCTION billing.responder_cotizacion(p_cotizacion_id BIGINT, p_cliente_id BIGINT,
                                                        p_acepta BOOLEAN, p_motivo TEXT DEFAULT NULL)
RETURNS billing.estado_cotizacion AS $$
DECLARE
    v_cot   billing.cotizaciones%ROWTYPE;
    v_orden orders.ordenes_servicio%ROWTYPE;
BEGIN
    SELECT * INTO v_cot FROM billing.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no existe'; END IF;

    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id = v_cot.orden_id;
    IF v_orden.cliente_id <> p_cliente_id THEN
        RAISE EXCEPTION 'Solo el cliente de la orden puede responder la cotización';
    END IF;
    IF v_cot.estado <> 'enviada' THEN
        RAISE EXCEPTION 'La cotización no está pendiente de respuesta (estado: %)', v_cot.estado;
    END IF;

    IF v_cot.expira_en IS NOT NULL AND v_cot.expira_en <= now() THEN
        UPDATE billing.cotizaciones SET estado = 'expirada', respondida_en = now() WHERE id = p_cotizacion_id;
        RETURN 'expirada';
    END IF;

    IF p_acepta THEN
        UPDATE billing.cotizaciones SET estado = 'reemplazada'
         WHERE orden_id = v_cot.orden_id AND estado = 'aceptada';
        UPDATE billing.cotizaciones SET estado = 'aceptada', respondida_en = now() WHERE id = p_cotizacion_id;
    ELSE
        UPDATE billing.cotizaciones
           SET estado = 'rechazada', respondida_en = now(), motivo_rechazo = p_motivo
         WHERE id = p_cotizacion_id;
    END IF;

    INSERT INTO chat.mensajes (conversacion_id, emisor_id, tipo, contenido, cotizacion_id)
    SELECT c.id, NULL, 'sistema',
           format('El cliente %s la cotización v%s', CASE WHEN p_acepta THEN 'aceptó' ELSE 'rechazó' END, v_cot.version),
           p_cotizacion_id
    FROM chat.conversaciones c WHERE c.orden_id = v_cot.orden_id AND c.abierta;

    IF v_orden.tecnico_id IS NOT NULL THEN
        INSERT INTO notification.notificaciones (usuario_id, orden_id, tipo, mensaje)
        VALUES (v_orden.tecnico_id, v_orden.id, 'cotizacion_respondida',
                format('El cliente %s tu cotización v%s', CASE WHEN p_acepta THEN 'aceptó' ELSE 'rechazó' END, v_cot.version));
    END IF;

    RETURN CASE WHEN p_acepta THEN 'aceptada' ELSE 'rechazada' END::billing.estado_cotizacion;
END $$ LANGUAGE plpgsql;

-- Ejecutar periódicamente
CREATE OR REPLACE FUNCTION billing.expirar_cotizaciones() RETURNS INT AS $$
DECLARE v_n INT;
BEGIN
    UPDATE billing.cotizaciones SET estado = 'expirada', respondida_en = now()
     WHERE estado = 'enviada' AND expira_en IS NOT NULL AND expira_en <= now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 9.4 PAGOS Y LIQUIDACIONES
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing.obtener_comision_pct(p_categoria_id INT, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC AS $$
    SELECT porcentaje FROM billing.comisiones
     WHERE categoria_id = p_categoria_id AND vigente_desde <= p_fecha
       AND (vigente_hasta IS NULL OR vigente_hasta >= p_fecha)
     ORDER BY vigente_desde DESC LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION billing.fn_pago_validar() RETURNS TRIGGER AS $$
DECLARE v_cot billing.cotizaciones%ROWTYPE;
BEGIN
    SELECT * INTO v_cot FROM billing.cotizaciones WHERE id = NEW.cotizacion_id;
    IF NOT FOUND OR v_cot.orden_id <> NEW.orden_id THEN
        RAISE EXCEPTION 'La cotización no corresponde a la orden';
    END IF;
    IF v_cot.estado <> 'aceptada' THEN
        RAISE EXCEPTION 'Solo se puede pagar una cotización aceptada';
    END IF;
    IF NEW.monto <> v_cot.total THEN
        RAISE EXCEPTION 'El monto (%) no coincide con la cotización aceptada (%)', NEW.monto, v_cot.total;
    END IF;
    IF NEW.estado = 'confirmado' AND NEW.pagado_en IS NULL THEN
        NEW.pagado_en := now();
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pago_validar
    BEFORE INSERT OR UPDATE OF estado ON billing.pagos
    FOR EACH ROW EXECUTE FUNCTION billing.fn_pago_validar();

-- Al confirmarse un pago se genera la liquidación con snapshot de comisión
CREATE OR REPLACE FUNCTION billing.fn_pago_liquidar() RETURNS TRIGGER AS $$
DECLARE
    v_orden    orders.ordenes_servicio%ROWTYPE;
    v_pct      NUMERIC;
    v_comision NUMERIC(12,2);
    v_efectivo BOOLEAN := (NEW.metodo = 'efectivo');
BEGIN
    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id = NEW.orden_id;
    IF v_orden.tecnico_id IS NULL THEN
        RAISE EXCEPTION 'No se puede liquidar una orden sin técnico';
    END IF;

    v_pct := billing.obtener_comision_pct(v_orden.categoria_id);
    IF v_pct IS NULL THEN
        RAISE EXCEPTION 'No hay comisión vigente configurada para la categoría %', v_orden.categoria_id;
    END IF;
    v_comision := ROUND(NEW.monto * v_pct / 100, 2);

    INSERT INTO billing.liquidaciones
        (pago_id, orden_id, tecnico_id, monto_bruto, comision_pct, comision_monto, neto_tecnico, cobrado_por, estado)
    VALUES
        (NEW.id, NEW.orden_id, v_orden.tecnico_id, NEW.monto, v_pct, v_comision, NEW.monto - v_comision,
         CASE WHEN v_efectivo THEN 'tecnico'::billing.quien_cobra ELSE 'plataforma'::billing.quien_cobra END,
         CASE WHEN v_efectivo THEN 'por_cobrar_tecnico'::billing.estado_liquidacion
                              ELSE 'pendiente_pago_tecnico'::billing.estado_liquidacion END)
    ON CONFLICT (pago_id) DO NOTHING;

    INSERT INTO notification.notificaciones (usuario_id, orden_id, tipo, mensaje)
    VALUES (v_orden.cliente_id, NEW.orden_id, 'pago', 'Tu pago fue confirmado. Gracias.');
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pago_liquidar
    AFTER INSERT OR UPDATE OF estado ON billing.pagos
    FOR EACH ROW WHEN (NEW.estado = 'confirmado')
    EXECUTE FUNCTION billing.fn_pago_liquidar();

-- Deuda de técnicos con la plataforma (pagos en efectivo)
CREATE OR REPLACE VIEW billing.v_deuda_tecnicos AS
SELECT tecnico_id, COUNT(*) AS ordenes_pendientes, SUM(comision_monto) AS comision_adeudada
FROM billing.liquidaciones
WHERE estado = 'por_cobrar_tecnico'
GROUP BY tecnico_id;

-- ---------------------------------------------------------------------------
-- 9.5 CHAT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chat.fn_validar_mensaje() RETURNS TRIGGER AS $$
DECLARE v_conv chat.conversaciones%ROWTYPE;
BEGIN
    SELECT * INTO v_conv FROM chat.conversaciones WHERE id = NEW.conversacion_id;
    IF NOT v_conv.abierta THEN
        RAISE EXCEPTION 'La conversación está cerrada';
    END IF;
    IF NEW.tipo <> 'sistema' AND NEW.emisor_id NOT IN (v_conv.cliente_id, v_conv.tecnico_id) THEN
        RAISE EXCEPTION 'El emisor no participa en esta conversación';
    END IF;
    -- Moderación básica: teléfonos (7+ dígitos) o emails para evitar sacar la transacción de la plataforma
    IF NEW.tipo = 'texto' AND (NEW.contenido ~ '(\d[ .-]*){7,}'
                               OR NEW.contenido ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}') THEN
        NEW.contiene_contacto := TRUE;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mensaje_validar
    BEFORE INSERT ON chat.mensajes
    FOR EACH ROW EXECUTE FUNCTION chat.fn_validar_mensaje();

-- Marca como leídos los mensajes del otro participante
CREATE OR REPLACE FUNCTION chat.marcar_leidos(p_conversacion_id BIGINT, p_usuario_id BIGINT) RETURNS INT AS $$
DECLARE v_n INT;
BEGIN
    UPDATE chat.mensajes
       SET leido_en = now(), entregado_en = COALESCE(entregado_en, now())
     WHERE conversacion_id = p_conversacion_id AND leido_en IS NULL
       AND (emisor_id IS NULL OR emisor_id <> p_usuario_id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 9.6 REPUTACIÓN
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reputation.fn_validar_calificacion() RETURNS TRIGGER AS $$
DECLARE v_orden orders.ordenes_servicio%ROWTYPE;
BEGIN
    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id = NEW.orden_id;
    IF v_orden.estado <> 'finalizado' THEN
        RAISE EXCEPTION 'Solo se pueden calificar órdenes finalizadas';
    END IF;
    IF NOT ((NEW.calificador_id = v_orden.cliente_id AND NEW.calificado_id = v_orden.tecnico_id)
         OR (NEW.calificador_id = v_orden.tecnico_id AND NEW.calificado_id = v_orden.cliente_id)) THEN
        RAISE EXCEPTION 'Calificador y calificado deben ser el cliente y el técnico de la orden';
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calificacion_validar
    BEFORE INSERT ON reputation.calificaciones
    FOR EACH ROW EXECUTE FUNCTION reputation.fn_validar_calificacion();

-- Fórmula v1 (documentada):
--   indice = 40% calificación (promedio/5)  + 25% tasa de resolución
--          + 20% puntualidad               + 15% tasa de aceptación de ofertas
CREATE OR REPLACE FUNCTION reputation.recalcular_indice(p_tecnico_id BIGINT) RETURNS VOID AS $$
DECLARE
    v_cal NUMERIC; v_fin INT; v_can INT; v_con_llegada INT; v_pun INT; v_resp INT; v_ace INT;
    v_resol NUMERIC; v_punt NUMERIC; v_acept NUMERIC; v_indice NUMERIC;
BEGIN
    SELECT COALESCE(AVG(puntaje), 0) INTO v_cal
      FROM reputation.calificaciones WHERE calificado_id = p_tecnico_id;

    SELECT COUNT(*) FILTER (WHERE estado = 'finalizado'),
           COUNT(*) FILTER (WHERE estado = 'cancelado' AND cancelado_por = p_tecnico_id),
           COUNT(*) FILTER (WHERE llegada_en IS NOT NULL AND llegada_estimada_en IS NOT NULL),
           COUNT(*) FILTER (WHERE llegada_en IS NOT NULL AND llegada_estimada_en IS NOT NULL
                              AND llegada_en <= llegada_estimada_en)
      INTO v_fin, v_can, v_con_llegada, v_pun
      FROM orders.ordenes_servicio WHERE tecnico_id = p_tecnico_id;

    SELECT COUNT(*) FILTER (WHERE estado IN ('aceptada', 'rechazada', 'expirada')),
           COUNT(*) FILTER (WHERE estado = 'aceptada')
      INTO v_resp, v_ace
      FROM orders.ofertas_orden WHERE tecnico_id = p_tecnico_id;

    v_resol := CASE WHEN v_fin + v_can = 0 THEN 0 ELSE 100.0 * v_fin / (v_fin + v_can) END;
    v_punt  := CASE WHEN v_con_llegada = 0 THEN 0 ELSE 100.0 * v_pun / v_con_llegada END;
    v_acept := CASE WHEN v_resp = 0 THEN 0 ELSE 100.0 * v_ace / v_resp END;
    v_indice := 0.40 * (v_cal / 5 * 100) + 0.25 * v_resol + 0.20 * v_punt + 0.15 * v_acept;

    INSERT INTO reputation.indices_reputacion
        (tecnico_id, tasa_resolucion, puntualidad, tasa_aceptacion, calificacion_promedio, indice_general, formula_version, actualizado_en)
    VALUES (p_tecnico_id, ROUND(v_resol, 2), ROUND(v_punt, 2), ROUND(v_acept, 2), ROUND(v_cal, 2), ROUND(v_indice, 2), 1, now())
    ON CONFLICT (tecnico_id) DO UPDATE SET
        tasa_resolucion = EXCLUDED.tasa_resolucion, puntualidad = EXCLUDED.puntualidad,
        tasa_aceptacion = EXCLUDED.tasa_aceptacion, calificacion_promedio = EXCLUDED.calificacion_promedio,
        indice_general = EXCLUDED.indice_general, formula_version = EXCLUDED.formula_version,
        actualizado_en = now();
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reputation.fn_calificacion_recalcular() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity.usuarios WHERE id = NEW.calificado_id AND rol = 'tecnico') THEN
        PERFORM reputation.recalcular_indice(NEW.calificado_id);
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calificacion_recalcular
    AFTER INSERT ON reputation.calificaciones
    FOR EACH ROW EXECUTE FUNCTION reputation.fn_calificacion_recalcular();

-- ---------------------------------------------------------------------------
-- 9.7 DISPUTAS: solo participantes de la orden
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_svc.fn_validar_disputa() RETURNS TRIGGER AS $$
DECLARE v_orden orders.ordenes_servicio%ROWTYPE;
BEGIN
    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id = NEW.orden_id;
    IF NOT ((NEW.abierta_por_id = v_orden.cliente_id AND NEW.contra_usuario_id = v_orden.tecnico_id)
         OR (NEW.abierta_por_id = v_orden.tecnico_id AND NEW.contra_usuario_id = v_orden.cliente_id)) THEN
        RAISE EXCEPTION 'La disputa debe ser entre el cliente y el técnico de la orden';
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_disputa_validar
    BEFORE INSERT ON admin_svc.disputas
    FOR EACH ROW EXECUTE FUNCTION admin_svc.fn_validar_disputa();

-- =============================================================================
-- 10. DATOS INICIALES
-- =============================================================================
INSERT INTO orders.transiciones_permitidas (estado_origen, estado_destino) VALUES
    ('solicitado',     'en_camino'),
    ('solicitado',     'cancelado'),
    ('en_camino',      'en_diagnostico'),
    ('en_camino',      'cancelado'),
    ('en_diagnostico', 'en_reparacion'),
    ('en_diagnostico', 'cancelado'),
    ('en_reparacion',  'finalizado'),
    ('en_reparacion',  'cancelado');

INSERT INTO orders.categorias_servicio (nombre, descripcion) VALUES
    ('Plomería',      'Fugas, destapes, instalación y reparación de tuberías'),
    ('Electricidad',  'Cortos circuitos, instalaciones y reparaciones eléctricas'),
    ('Climatización', 'Aires acondicionados, calefacción y refrigeración');

-- VALORES DE EJEMPLO (Bs). Ajustar a la realidad del negocio antes de producción.
INSERT INTO billing.tarifas (categoria_id, tarifa_visita, tarifa_hora, recargo_urgencia_pct) VALUES
    (1, 50.00, 60.00, 30),
    (2, 60.00, 70.00, 30),
    (3, 80.00, 90.00, 25);

INSERT INTO billing.comisiones (categoria_id, porcentaje) VALUES
    (1, 15.00),
    (2, 15.00),
    (3, 15.00);

-- =============================================================================
-- 11. FLUJO TÍPICO (referencia)
-- =============================================================================
--  1. INSERT en orders.ordenes_servicio                 -> queda 'solicitado' (+ historial)
--  2. SELECT billing.generar_cotizacion_inicial(orden)  -> estimado por tarifas, aceptado por el cliente
--  3. INSERT en orders.ofertas_orden (técnicos cercanos, ordenados por reputación)
--  4. SELECT orders.aceptar_oferta(oferta, tecnico)     -> atómico; crea chat; orden pasa a 'en_camino'
--  5. UPDATE orden SET estado='en_diagnostico'          -> se registra llegada_en
--  6. INSERT cotizacion (motivo obligatorio) + ítems    -> borrador (total se calcula solo)
--  7. SELECT billing.enviar_cotizacion(cot, tecnico)    -> tarjeta en chat + notificación
--  8. SELECT billing.responder_cotizacion(cot, cliente, true)
--  9. UPDATE orden SET estado='en_reparacion'           -> solo si hay cotización aceptada
-- 10. UPDATE orden SET estado='finalizado'              -> cierra chat, libera al técnico
-- 11. INSERT billing.pagos (monto = cotización aceptada) -> al confirmar genera liquidación
-- 12. INSERT reputation.calificaciones                  -> recalcula índice del técnico
--
-- Jobs periódicos recomendados (pg_cron o scheduler de la app):
--   orders.expirar_ofertas()        cada 30 s
--   billing.expirar_cotizaciones()  cada 1 min
--   geo.crear_particion_ubicaciones(...)  mensual

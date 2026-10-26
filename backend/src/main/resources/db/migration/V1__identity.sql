-- =============================================================================
-- V1: Módulo IDENTITY (cuentas, autenticación, perfiles de técnico)
-- Requiere PostgreSQL con PostGIS (imagen postgis/postgis:16-3.4).
-- Regla de oro de Flyway: una migración ya aplicada NUNCA se edita.
-- Los cambios futuros van en V8, V9...
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Función reutilizable: mantiene "actualizado_en" al día en cada UPDATE.
CREATE OR REPLACE FUNCTION set_actualizado_en() RETURNS trigger AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE identity.usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol             VARCHAR(20)  NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    telefono        VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,          -- BCrypt (RNF-07), jamás la contraseña
    foto_perfil_url TEXT,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_usuarios_rol CHECK (rol IN ('CLIENTE', 'TECNICO', 'ADMINISTRADOR'))
);

-- Email único sin distinguir mayúsculas: "Ana@mail.com" = "ana@mail.com"
CREATE UNIQUE INDEX uq_usuarios_email ON identity.usuarios (lower(email));

CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON identity.usuarios
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- Datos propios del rol técnico (RF-05, RF-21)
CREATE TABLE identity.perfiles_tecnico (
    usuario_id        UUID PRIMARY KEY REFERENCES identity.usuarios(id) ON DELETE CASCADE,
    estado_validacion VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    disponible        BOOLEAN     NOT NULL DEFAULT FALSE,   -- ¿está recibiendo órdenes ahora?
    validado_por      UUID REFERENCES identity.usuarios(id),
    validado_en       TIMESTAMPTZ,
    CONSTRAINT chk_perfil_estado CHECK (estado_validacion IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    -- Regla de negocio protegida en la base: solo un técnico aprobado puede estar disponible
    CONSTRAINT chk_perfil_disponible CHECK (NOT disponible OR estado_validacion = 'APROBADO'),
    -- Si ya fue revisado, debe constar quién y cuándo
    CONSTRAINT chk_perfil_revision CHECK (
        (estado_validacion = 'PENDIENTE' AND validado_en IS NULL)
        OR (estado_validacion <> 'PENDIENTE' AND validado_en IS NOT NULL AND validado_por IS NOT NULL)
    )
);

-- Reemplaza documento_identidad_url y certificaciones_url TEXT[]
CREATE TABLE identity.documentos_tecnico (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tecnico_id UUID        NOT NULL REFERENCES identity.perfiles_tecnico(usuario_id) ON DELETE CASCADE,
    tipo       VARCHAR(30) NOT NULL,
    url        TEXT        NOT NULL,
    subido_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_documento_tipo CHECK (tipo IN ('DOCUMENTO_IDENTIDAD', 'CERTIFICACION', 'OTRO'))
);

-- PostgreSQL NO indexa las llaves foráneas automáticamente
CREATE INDEX idx_documentos_tecnico ON identity.documentos_tecnico(tecnico_id);

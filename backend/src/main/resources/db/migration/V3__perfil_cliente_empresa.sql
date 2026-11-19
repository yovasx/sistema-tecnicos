-- =============================================================================
-- V3: perfil de cliente persona / empresa
-- =============================================================================
-- El ROL sigue siendo 'cliente' para autorización y para todas las reglas de la
-- base. Lo que cambia es el PERFIL: una empresa también es cliente, pero tiene
-- razón social, NIT y (a futuro) otros casos de uso como facturación.
--
-- No se toca ninguna función de la máquina de estados: las órdenes, ofertas,
-- cotizaciones y pagos siguen colgando de identity.usuarios sin distinción.

CREATE TYPE identity.tipo_cliente AS ENUM ('persona', 'empresa');

ALTER TABLE identity.usuarios
    ADD COLUMN tipo_cliente identity.tipo_cliente NOT NULL DEFAULT 'persona',
    ADD COLUMN razon_social VARCHAR(150),
    ADD COLUMN nit          VARCHAR(20);

-- Una empresa sin razón social ni NIT no puede facturar: se exigen juntos.
ALTER TABLE identity.usuarios
    ADD CONSTRAINT ck_usuarios_empresa_datos CHECK (
        tipo_cliente = 'persona'
        OR (razon_social IS NOT NULL AND btrim(razon_social) <> ''
            AND nit IS NOT NULL AND btrim(nit) <> '')
    );

-- Solo un cliente puede ser empresa: técnicos y administradores son personas.
ALTER TABLE identity.usuarios
    ADD CONSTRAINT ck_usuarios_tipo_cliente_rol CHECK (
        tipo_cliente = 'persona' OR rol = 'cliente'
    );

-- El NIT identifica a la empresa: no se repite entre cuentas activas.
CREATE UNIQUE INDEX uq_usuarios_nit
    ON identity.usuarios (nit)
    WHERE nit IS NOT NULL AND eliminado_en IS NULL;

-- -----------------------------------------------------------------------------
-- Seed de desarrollo: una empresa cliente de La Paz (idempotente).
-- Contraseña: Fixly2026!  (mismo hash que los demás seeds de V2)
-- -----------------------------------------------------------------------------
INSERT INTO identity.usuarios (
    rol, nombre, apellido, email, telefono, password_hash, activo,
    tipo_cliente, razon_social, nit
)
SELECT 'cliente'::identity.rol_usuario,
       'Contacto',
       'Ferretería La Paz',
       'contacto@ferreteria-lapaz.bo',
       '+591 22456789',
       '$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG',
       TRUE,
       'empresa'::identity.tipo_cliente,
       'Ferretería La Paz S.R.L.',
       '1234567021'
WHERE NOT EXISTS (
    SELECT 1 FROM identity.usuarios u
    WHERE lower(u.email) = 'contacto@ferreteria-lapaz.bo'
      AND u.eliminado_en IS NULL
);

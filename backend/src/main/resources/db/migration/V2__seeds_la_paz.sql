-- =============================================================================
-- V2: seeds de desarrollo para La Paz (idempotentes)
-- =============================================================================
-- Regla: NUNCA se edita V1 una vez aplicada; Flyway guarda el checksum y
-- rechazaría el cambio. Todo dato nuevo va en una migración nueva.
--
-- Idempotencia: cada bloque consulta si los datos ya existen antes de insertar,
-- así que correr la migración dos veces no duplica nada.

-- -----------------------------------------------------------------------------
-- 1. Catálogo de categorías
-- -----------------------------------------------------------------------------
INSERT INTO orders.categorias_servicio (nombre, descripcion, activa)
SELECT v.nombre, v.descripcion, TRUE
FROM (VALUES
    ('Plomería',      'Instalación, reparación y mantenimiento de agua, gas y desagües.', TRUE),
    ('Electricidad',  'Instalaciones, cortocircuitos, tableros y luminarias.',           TRUE),
    ('Climatización', 'Aire acondicionado, calefacción y ventilación.',                  TRUE)
) AS v(nombre, descripcion, activa)
WHERE NOT EXISTS (
    SELECT 1 FROM orders.categorias_servicio c WHERE c.nombre = v.nombre
);

-- -----------------------------------------------------------------------------
-- 2. Tarifas vigentes (alimentan la cotización inicial)
-- -----------------------------------------------------------------------------
INSERT INTO billing.tarifas (categoria_id, tarifa_visita, tarifa_hora, recargo_urgencia_pct, moneda)
SELECT c.id, v.visita, v.hora, 30.00, 'BOB'
FROM orders.categorias_servicio c
JOIN (VALUES
    ('Plomería',      50.00, 80.00),
    ('Electricidad',  45.00, 75.00),
    ('Climatización', 60.00, 90.00)
) AS v(nombre, visita, hora) ON v.nombre = c.nombre
WHERE NOT EXISTS (
    SELECT 1 FROM billing.tarifas t WHERE t.categoria_id = c.id
);

-- -----------------------------------------------------------------------------
-- 3. Comisión de la plataforma: 15% por categoría
-- -----------------------------------------------------------------------------
INSERT INTO billing.comisiones (categoria_id, porcentaje)
SELECT c.id, 15.00
FROM orders.categorias_servicio c
WHERE NOT EXISTS (
    SELECT 1 FROM billing.comisiones co WHERE co.categoria_id = c.id
);

-- -----------------------------------------------------------------------------
-- 4. Usuarios de prueba (1 admin, 2 clientes, 3 técnicos)
--     Contraseña de todos: Fixly2026!
--     Solo para desarrollo: nunca sembrar en producción.
-- -----------------------------------------------------------------------------
INSERT INTO identity.usuarios (rol, nombre, apellido, email, telefono, password_hash, activo)
SELECT v.rol::identity.rol_usuario,
       v.nombre,
       v.apellido,
       v.email,
       v.telefono,
       v.password_hash,
       TRUE
FROM (VALUES
    ('administrador', 'Andrés',       'Rojas',        'admin@fixly.bo',          '+591 70000001', '$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG'),
    ('cliente',       'María Fernanda','Quispe',      'maria.quispe@ejemplo.bo', '+591 71234567', '$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG'),
    ('cliente',       'Jorge',        'Mamani',       'jorge.mamani@ejemplo.bo', '+591 72345678', '$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG'),
    ('tecnico',       'Diego',        'Vargas',       'diego.vargas@ejemplo.bo', '+591 73456789', '$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG'),
    ('tecnico',       'Lucía',        'Fernández',    'lucia.fernandez@ejemplo.bo', '+591 74567890', '$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG'),
    ('tecnico',       'Raúl',         'Choque',       'raul.choque@ejemplo.bo',  '+591 75678901', '$2a$10$w3cjHPuZ3yLyH7/X0g4ukuQFErMMOrtLm8tKTK8HtEdV7uQIeCYHG')
) AS v(rol, nombre, apellido, email, telefono, password_hash)
WHERE NOT EXISTS (
    SELECT 1 FROM identity.usuarios u
    WHERE lower(u.email) = lower(v.email) AND u.eliminado_en IS NULL
);

-- -----------------------------------------------------------------------------
-- 5. Perfiles de técnico: aprobados y disponibles para que el matching encuentre
--    candidatos desde el primer día.
-- -----------------------------------------------------------------------------
INSERT INTO identity.perfiles_tecnico (usuario_id, estado_validacion, disponibilidad, certificaciones_url)
SELECT u.id, 'aprobado', 'disponible', ARRAY['certificado-tecnico-bo.pdf']::TEXT[]
FROM identity.usuarios u
WHERE u.rol = 'tecnico'
  AND NOT EXISTS (SELECT 1 FROM identity.perfiles_tecnico p WHERE p.usuario_id = u.id);

-- Especialidades normalizadas (una fila por técnico + categoría)
INSERT INTO identity.tecnico_especialidades (tecnico_id, categoria_id)
SELECT u.id, c.id
FROM (VALUES
    ('diego.vargas@ejemplo.bo',   'Plomería'),
    ('diego.vargas@ejemplo.bo',   'Electricidad'),
    ('lucia.fernandez@ejemplo.bo','Electricidad'),
    ('lucia.fernandez@ejemplo.bo','Climatización'),
    ('raul.choque@ejemplo.bo',    'Climatización'),
    ('raul.choque@ejemplo.bo',    'Plomería')
) AS v(email, categoria)
JOIN identity.usuarios u      ON lower(u.email) = lower(v.email)
JOIN orders.categorias_servicio c ON c.nombre = v.categoria
WHERE NOT EXISTS (
    SELECT 1 FROM identity.tecnico_especialidades e
    WHERE e.tecnico_id = u.id AND e.categoria_id = c.id
);

-- -----------------------------------------------------------------------------
-- 6. Zonas de cobertura en La Paz (polígonos reales, contraídos para que el
--    matching devuelva candidatos en las primeras pruebas).
--    Anillos en sentido antihorario: así los interpreta bien PostGIS.
-- -----------------------------------------------------------------------------
INSERT INTO geo.zonas_cobertura (tecnico_id, nombre_zona, poligono, activo)
SELECT u.id, v.nombre_zona, ST_GeomFromText(v.wkt, 4326)::GEOGRAPHY, TRUE
FROM (VALUES
    ('diego.vargas@ejemplo.bo',   'Sopocachi',
     'POLYGON((-68.1450 -16.4920, -68.1450 -16.5050, -68.1250 -16.5050, -68.1250 -16.4920, -68.1450 -16.4920))'),
    ('lucia.fernandez@ejemplo.bo','Miraflores',
     'POLYGON((-68.1250 -16.4980, -68.1250 -16.5120, -68.1050 -16.5120, -68.1050 -16.4980, -68.1250 -16.4980))'),
    ('raul.choque@ejemplo.bo',    'Calacoto (Zona Sur)',
     'POLYGON((-68.1150 -16.5380, -68.1150 -16.5530, -68.0950 -16.5530, -68.0950 -16.5380, -68.1150 -16.5380))')
) AS v(email, nombre_zona, wkt)
JOIN identity.usuarios u ON lower(u.email) = lower(v.email)
WHERE NOT EXISTS (
    SELECT 1 FROM geo.zonas_cobertura z WHERE z.tecnico_id = u.id
);

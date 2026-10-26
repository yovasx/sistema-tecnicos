-- =============================================================================
-- V3: Datos de referencia (catálogo). Separados del esquema a propósito:
-- la estructura y los datos cambian por razones distintas.
-- NO pongas aquí usuarios admin con contraseñas: eso se crea desde la app/entorno.
-- =============================================================================

INSERT INTO orders.categorias_servicio (nombre, descripcion) VALUES
    ('Plomería',      'Fugas, destapes, instalación y reparación de tuberías'),
    ('Electricidad',  'Cortocircuitos, instalaciones y reparaciones eléctricas'),
    ('Climatización', 'Aires acondicionados, calefacción y refrigeración')
ON CONFLICT (nombre) DO NOTHING;

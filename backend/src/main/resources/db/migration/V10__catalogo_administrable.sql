-- V10: catálogo administrable.
--
-- Una sola escritura administrativa puede cambiar categoría, tarifa y comisión
-- al mismo tiempo. Las tarifas y comisiones no se sobrescriben: se versionan por
-- vigencia para no alterar importes históricos. Nada se borra físicamente.

-- -----------------------------------------------------------------------------
-- 1. Unicidad del nombre sin distinguir mayúsculas ni espacios de los extremos
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_categorias_nombre_lower
    ON orders.categorias_servicio (lower(btrim(nombre)));

-- Una sola fila vigente por categoría: la versión abierta es la actual.
CREATE UNIQUE INDEX uq_tarifas_vigente
    ON billing.tarifas (categoria_id) WHERE vigente_hasta IS NULL;
CREATE UNIQUE INDEX uq_comisiones_vigente
    ON billing.comisiones (categoria_id) WHERE vigente_hasta IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Auditoría de cambios del catálogo
-- -----------------------------------------------------------------------------
CREATE TABLE admin_svc.auditoria_catalogo (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id INT NOT NULL REFERENCES orders.categorias_servicio(id),
    admin_id     BIGINT NOT NULL REFERENCES identity.usuarios(id),
    accion       TEXT NOT NULL CHECK (accion IN ('crear', 'editar')),
    antes        JSONB,
    despues      JSONB NOT NULL,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_auditoria_catalogo_categoria
    ON admin_svc.auditoria_catalogo (categoria_id, id DESC);

-- -----------------------------------------------------------------------------
-- 3. Guardia: solo un administrador activo, y debe ser el usuario de la sesión
-- -----------------------------------------------------------------------------
CREATE FUNCTION admin_svc.validar_admin_catalogo(p_admin BIGINT) RETURNS VOID AS $$
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_admin OR NOT EXISTS (
        SELECT 1 FROM identity.usuarios
        WHERE id = p_admin AND rol = 'administrador' AND activo AND eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'Solo un administrador activo puede modificar el catálogo.';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 4. Foto completa de una categoría (categoría + tarifa + comisión vigentes)
-- -----------------------------------------------------------------------------
CREATE FUNCTION admin_svc.categoria_json(p_id INT) RETURNS JSONB AS $$
    SELECT jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'descripcion', c.descripcion,
        'activa', c.activa,
        'tarifaVisita', t.tarifa_visita,
        'tarifaHora', t.tarifa_hora,
        'recargoUrgenciaPct', t.recargo_urgencia_pct,
        'moneda', t.moneda,
        'tarifaVigenteDesde', t.vigente_desde,
        'comisionPct', co.porcentaje,
        'comisionVigenteDesde', co.vigente_desde
    )
    FROM orders.categorias_servicio c
    LEFT JOIN LATERAL (
        SELECT * FROM billing.tarifas
        WHERE categoria_id = c.id AND vigente_hasta IS NULL
        ORDER BY vigente_desde DESC, id DESC
        LIMIT 1
    ) t ON TRUE
    LEFT JOIN LATERAL (
        SELECT * FROM billing.comisiones
        WHERE categoria_id = c.id AND vigente_hasta IS NULL
        ORDER BY vigente_desde DESC, id DESC
        LIMIT 1
    ) co ON TRUE
    WHERE c.id = p_id;
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- 5. Guardado atómico: crear (p_id NULL) o editar
-- -----------------------------------------------------------------------------
CREATE FUNCTION admin_svc.guardar_categoria(
    p_admin BIGINT,
    p_id INT,
    p_nombre VARCHAR,
    p_descripcion TEXT,
    p_activa BOOLEAN,
    p_tarifa_visita NUMERIC,
    p_tarifa_hora NUMERIC,
    p_recargo_urgencia_pct NUMERIC,
    p_moneda CHAR(3),
    p_comision_pct NUMERIC
) RETURNS INT AS $$
DECLARE
    v_id       INT := p_id;
    v_antes    JSONB;
    v_despues  JSONB;
    v_tarifa   billing.tarifas%ROWTYPE;
    v_comision billing.comisiones%ROWTYPE;
BEGIN
    PERFORM admin_svc.validar_admin_catalogo(p_admin);

    IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 80 THEN
        RAISE EXCEPTION 'El nombre de la categoría debe tener entre 2 y 80 caracteres.';
    END IF;
    IF p_descripcion IS NOT NULL AND length(btrim(p_descripcion)) > 500 THEN
        RAISE EXCEPTION 'La descripción no puede superar los 500 caracteres.';
    END IF;
    IF p_activa IS NULL THEN
        RAISE EXCEPTION 'Indicá si la categoría está activa.';
    END IF;
    IF p_tarifa_visita IS NULL OR p_tarifa_visita < 0 OR p_tarifa_visita > 99999999.99 THEN
        RAISE EXCEPTION 'La tarifa de visita debe ser un monto entre 0 y 99.999.999,99 Bs.';
    END IF;
    IF p_tarifa_hora IS NOT NULL AND (p_tarifa_hora < 0 OR p_tarifa_hora > 99999999.99) THEN
        RAISE EXCEPTION 'La tarifa por hora debe ser un monto entre 0 y 99.999.999,99 Bs.';
    END IF;
    IF p_recargo_urgencia_pct IS NULL OR p_recargo_urgencia_pct NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'El recargo de urgencia debe estar entre 0 y 100%%.';
    END IF;
    IF p_comision_pct IS NULL OR p_comision_pct NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'La comisión de la plataforma debe estar entre 0 y 100%%.';
    END IF;
    IF p_moneda IS NULL OR upper(btrim(p_moneda)) !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Indicá una moneda de tres letras, por ejemplo BOB.';
    END IF;

    -- Categoría -----------------------------------------------------------------
    IF v_id IS NULL THEN
        INSERT INTO orders.categorias_servicio (nombre, descripcion, activa)
        VALUES (btrim(p_nombre), NULLIF(btrim(p_descripcion), ''), p_activa)
        RETURNING id INTO v_id;
    ELSE
        SELECT admin_svc.categoria_json(v_id) INTO v_antes;
        PERFORM 1 FROM orders.categorias_servicio WHERE id = v_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La categoría indicada no existe.';
        END IF;
        UPDATE orders.categorias_servicio
        SET nombre = btrim(p_nombre),
            descripcion = NULLIF(btrim(p_descripcion), ''),
            activa = p_activa
        WHERE id = v_id;
    END IF;

    -- Tarifa --------------------------------------------------------------------
    SELECT * INTO v_tarifa
    FROM billing.tarifas
    WHERE categoria_id = v_id AND vigente_hasta IS NULL
    ORDER BY vigente_desde DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO billing.tarifas
            (categoria_id, tarifa_visita, tarifa_hora, recargo_urgencia_pct, moneda, vigente_desde)
        VALUES
            (v_id, p_tarifa_visita, p_tarifa_hora, p_recargo_urgencia_pct,
             upper(btrim(p_moneda)), CURRENT_DATE);
    ELSIF v_tarifa.vigente_desde >= CURRENT_DATE THEN
        -- Mismo día (o una versión futura ya cargada): se corrige en sitio.
        UPDATE billing.tarifas
        SET tarifa_visita = p_tarifa_visita,
            tarifa_hora = p_tarifa_hora,
            recargo_urgencia_pct = p_recargo_urgencia_pct,
            moneda = upper(btrim(p_moneda))
        WHERE id = v_tarifa.id;
    ELSE
        -- Cambio en otro día: se cierra la versión anterior y se abre una nueva.
        UPDATE billing.tarifas SET vigente_hasta = CURRENT_DATE - 1 WHERE id = v_tarifa.id;
        INSERT INTO billing.tarifas
            (categoria_id, tarifa_visita, tarifa_hora, recargo_urgencia_pct, moneda, vigente_desde)
        VALUES
            (v_id, p_tarifa_visita, p_tarifa_hora, p_recargo_urgencia_pct,
             upper(btrim(p_moneda)), CURRENT_DATE);
    END IF;

    -- Comisión ------------------------------------------------------------------
    SELECT * INTO v_comision
    FROM billing.comisiones
    WHERE categoria_id = v_id AND vigente_hasta IS NULL
    ORDER BY vigente_desde DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO billing.comisiones (categoria_id, porcentaje, vigente_desde)
        VALUES (v_id, p_comision_pct, CURRENT_DATE);
    ELSIF v_comision.vigente_desde >= CURRENT_DATE THEN
        UPDATE billing.comisiones SET porcentaje = p_comision_pct WHERE id = v_comision.id;
    ELSE
        UPDATE billing.comisiones SET vigente_hasta = CURRENT_DATE - 1 WHERE id = v_comision.id;
        INSERT INTO billing.comisiones (categoria_id, porcentaje, vigente_desde)
        VALUES (v_id, p_comision_pct, CURRENT_DATE);
    END IF;

    -- Auditoría -----------------------------------------------------------------
    v_despues := admin_svc.categoria_json(v_id);
    INSERT INTO admin_svc.auditoria_catalogo (categoria_id, admin_id, accion, antes, despues)
    VALUES (
        v_id,
        p_admin,
        CASE WHEN p_id IS NULL THEN 'crear' ELSE 'editar' END,
        v_antes,
        v_despues
    );

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

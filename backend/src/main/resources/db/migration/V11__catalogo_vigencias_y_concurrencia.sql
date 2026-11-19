-- V10 ya aplicada: corregir sin cambiar su checksum.
-- Tomar la foto de auditoría después del lock y versionar únicamente los
-- importes modificados. Editar una descripción no debe renovar los precios.
CREATE OR REPLACE FUNCTION admin_svc.categoria_json(p_id INT) RETURNS JSONB AS $$
    SELECT jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'descripcion', c.descripcion, 'activa', c.activa,
        'tarifaVisita', t.tarifa_visita, 'tarifaHora', t.tarifa_hora,
        'recargoUrgenciaPct', t.recargo_urgencia_pct, 'moneda', t.moneda,
        'tarifaVigenteDesde', t.vigente_desde, 'comisionPct', co.porcentaje,
        'comisionVigenteDesde', co.vigente_desde)
    FROM orders.categorias_servicio c
    LEFT JOIN LATERAL (
        SELECT * FROM billing.tarifas WHERE categoria_id = c.id
          AND vigente_desde <= CURRENT_DATE AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
        ORDER BY vigente_desde DESC, id DESC LIMIT 1
    ) t ON TRUE
    LEFT JOIN LATERAL (
        SELECT * FROM billing.comisiones WHERE categoria_id = c.id
          AND vigente_desde <= CURRENT_DATE AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
        ORDER BY vigente_desde DESC, id DESC LIMIT 1
    ) co ON TRUE WHERE c.id = p_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION admin_svc.validar_admin_catalogo(p_admin BIGINT) RETURNS VOID AS $$
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_admin OR NOT EXISTS (
        SELECT 1 FROM identity.usuarios
        WHERE id = p_admin AND rol = 'administrador' AND activo AND eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'Solo un administrador activo puede modificar el catálogo.'
            USING ERRCODE = '42501';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION admin_svc.guardar_categoria(
    p_admin BIGINT, p_id INT, p_nombre VARCHAR, p_descripcion TEXT,
    p_activa BOOLEAN, p_tarifa_visita NUMERIC, p_tarifa_hora NUMERIC,
    p_recargo_urgencia_pct NUMERIC, p_moneda CHAR(3), p_comision_pct NUMERIC
) RETURNS INT AS $$
DECLARE
    v_id INT := p_id;
    v_antes JSONB;
    v_tarifa billing.tarifas%ROWTYPE;
    v_comision billing.comisiones%ROWTYPE;
BEGIN
    PERFORM admin_svc.validar_admin_catalogo(p_admin);
    IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 80 THEN
        RAISE EXCEPTION 'El nombre de la categoría debe tener entre 2 y 80 caracteres.';
    END IF;
    IF length(btrim(p_descripcion)) > 500 THEN
        RAISE EXCEPTION 'La descripción no puede superar los 500 caracteres.';
    END IF;
    IF p_activa IS NULL THEN RAISE EXCEPTION 'Indicá si la categoría está activa.'; END IF;
    IF p_tarifa_visita IS NULL OR p_tarifa_visita NOT BETWEEN 0 AND 99999999.99
       OR p_tarifa_visita <> round(p_tarifa_visita, 2)
       OR (p_tarifa_hora IS NOT NULL AND (p_tarifa_hora NOT BETWEEN 0 AND 99999999.99
           OR p_tarifa_hora <> round(p_tarifa_hora, 2))) THEN
        RAISE EXCEPTION 'Ingresá tarifas entre 0 y 99.999.999,99 con hasta dos decimales.';
    END IF;
    IF p_recargo_urgencia_pct IS NULL OR p_recargo_urgencia_pct NOT BETWEEN 0 AND 100
       OR p_recargo_urgencia_pct <> round(p_recargo_urgencia_pct, 2)
       OR p_comision_pct IS NULL OR p_comision_pct NOT BETWEEN 0 AND 100
       OR p_comision_pct <> round(p_comision_pct, 2) THEN
        RAISE EXCEPTION 'Los porcentajes deben estar entre 0 y 100%% con hasta dos decimales.';
    END IF;
    -- El catálogo y su vista pública trabajan en bolivianos, sin conversión.
    IF p_moneda IS NULL OR upper(btrim(p_moneda)) <> 'BOB' THEN
        RAISE EXCEPTION 'El catálogo solo admite bolivianos (BOB).';
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO orders.categorias_servicio(nombre, descripcion, activa)
        VALUES(btrim(p_nombre), NULLIF(btrim(p_descripcion), ''), p_activa)
        RETURNING id INTO v_id;
    ELSE
        -- Serializa cambios y captura exactamente el estado que se reemplaza.
        PERFORM 1 FROM orders.categorias_servicio WHERE id = v_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'La categoría indicada no existe.'; END IF;
        v_antes := admin_svc.categoria_json(v_id);
        UPDATE orders.categorias_servicio
        SET nombre = btrim(p_nombre), descripcion = NULLIF(btrim(p_descripcion), ''), activa = p_activa
        WHERE id = v_id;
    END IF;

    -- No modificar una programación futura cargada fuera de este flujo.
    IF EXISTS(SELECT 1 FROM billing.tarifas WHERE categoria_id = v_id AND vigente_desde > CURRENT_DATE)
       OR EXISTS(SELECT 1 FROM billing.comisiones WHERE categoria_id = v_id AND vigente_desde > CURRENT_DATE) THEN
        RAISE EXCEPTION 'La categoría tiene precios futuros programados. Revisá sus vigencias antes de editarla.';
    END IF;

    SELECT * INTO v_tarifa FROM billing.tarifas
    WHERE categoria_id = v_id AND vigente_desde <= CURRENT_DATE
      AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
    ORDER BY vigente_desde DESC, id DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO billing.tarifas(categoria_id, tarifa_visita, tarifa_hora, recargo_urgencia_pct, moneda)
        VALUES(v_id, p_tarifa_visita, p_tarifa_hora, p_recargo_urgencia_pct, 'BOB');
    ELSIF ROW(v_tarifa.tarifa_visita, v_tarifa.tarifa_hora, v_tarifa.recargo_urgencia_pct, v_tarifa.moneda)
          IS DISTINCT FROM ROW(p_tarifa_visita, p_tarifa_hora, p_recargo_urgencia_pct, 'BOB'::CHAR(3)) THEN
        IF v_tarifa.vigente_desde = CURRENT_DATE THEN
            UPDATE billing.tarifas SET tarifa_visita = p_tarifa_visita, tarifa_hora = p_tarifa_hora,
                recargo_urgencia_pct = p_recargo_urgencia_pct, moneda = 'BOB' WHERE id = v_tarifa.id;
        ELSE
            UPDATE billing.tarifas SET vigente_hasta = CURRENT_DATE - 1 WHERE id = v_tarifa.id;
            INSERT INTO billing.tarifas(categoria_id, tarifa_visita, tarifa_hora, recargo_urgencia_pct, moneda,
                                        vigente_hasta)
            VALUES(v_id, p_tarifa_visita, p_tarifa_hora, p_recargo_urgencia_pct, 'BOB', v_tarifa.vigente_hasta);
        END IF;
    END IF;

    SELECT * INTO v_comision FROM billing.comisiones
    WHERE categoria_id = v_id AND vigente_desde <= CURRENT_DATE
      AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
    ORDER BY vigente_desde DESC, id DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO billing.comisiones(categoria_id, porcentaje) VALUES(v_id, p_comision_pct);
    ELSIF v_comision.porcentaje IS DISTINCT FROM p_comision_pct THEN
        IF v_comision.vigente_desde = CURRENT_DATE THEN
            UPDATE billing.comisiones SET porcentaje = p_comision_pct WHERE id = v_comision.id;
        ELSE
            UPDATE billing.comisiones SET vigente_hasta = CURRENT_DATE - 1 WHERE id = v_comision.id;
            INSERT INTO billing.comisiones(categoria_id, porcentaje, vigente_hasta)
            VALUES(v_id, p_comision_pct, v_comision.vigente_hasta);
        END IF;
    END IF;

    INSERT INTO admin_svc.auditoria_catalogo(categoria_id, admin_id, accion, antes, despues)
    VALUES(v_id, p_admin, CASE WHEN p_id IS NULL THEN 'crear' ELSE 'editar' END,
           v_antes, admin_svc.categoria_json(v_id));
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

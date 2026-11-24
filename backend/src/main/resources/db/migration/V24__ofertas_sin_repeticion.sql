-- V24: no volver a enviar ofertas a técnicos que ya recibieron esta orden.
CREATE OR REPLACE FUNCTION orders.generar_ofertas(
    p_orden BIGINT,
    p_limite INT DEFAULT 6,
    p_minutos INT DEFAULT 2
) RETURNS INT AS $$
DECLARE
    v_orden orders.ordenes_servicio%ROWTYPE;
    v_n INT := 0;
BEGIN
    IF p_limite IS NULL OR p_limite < 1 OR p_limite > 20
       OR p_minutos IS NULL OR p_minutos < 1 OR p_minutos > 15 THEN
        RAISE EXCEPTION 'Los parámetros del match no son válidos.';
    END IF;

    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id = p_orden FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    IF v_orden.estado <> 'solicitado' OR v_orden.tecnico_id IS NOT NULL THEN
        RETURN 0;
    END IF;

    WITH candidatos AS (
        SELECT p.usuario_id AS tecnico_id,
               CASE WHEN ub.actualizado_en > clock_timestamp() - interval '10 minutes'
                    THEN ST_Distance(ub.punto, v_orden.ubicacion_cliente) END AS distancia,
               coalesce(ir.indice_general, 50) AS indice,
               p.usuario_id AS desempate
        FROM identity.perfiles_tecnico p
        JOIN identity.usuarios u ON u.id = p.usuario_id
        LEFT JOIN geo.ubicacion_actual ub ON ub.tecnico_id = p.usuario_id
        LEFT JOIN reputation.indices_reputacion ir ON ir.tecnico_id = p.usuario_id
        WHERE u.rol = 'tecnico'
          AND u.activo AND u.eliminado_en IS NULL
          AND p.estado_validacion = 'aprobado'
          AND p.disponibilidad = 'disponible'
          AND EXISTS (SELECT 1 FROM identity.tecnico_especialidades e
                      WHERE e.tecnico_id = p.usuario_id
                        AND e.categoria_id = v_orden.categoria_id)
          AND EXISTS (SELECT 1 FROM geo.zonas_cobertura z
                      WHERE z.tecnico_id = p.usuario_id AND z.activo
                        AND ST_Covers(z.poligono::geometry,
                                      v_orden.ubicacion_cliente::geometry))
          AND NOT EXISTS (SELECT 1 FROM orders.ordenes_servicio a
                          WHERE a.tecnico_id = p.usuario_id
                            AND a.estado NOT IN ('finalizado', 'cancelado'))
          AND NOT EXISTS (SELECT 1 FROM orders.ofertas_orden f
                          WHERE f.orden_id = p_orden
                            AND f.tecnico_id = p.usuario_id)
        ORDER BY distancia NULLS LAST, indice DESC, desempate
        LIMIT p_limite
    ), insertadas AS (
        INSERT INTO orders.ofertas_orden(orden_id, tecnico_id, distancia_metros, expira_en)
        SELECT p_orden, c.tecnico_id, c.distancia,
               clock_timestamp() + (p_minutos * interval '1 minute')
        FROM candidatos c
        ON CONFLICT (orden_id, tecnico_id) DO NOTHING
        RETURNING tecnico_id
    )
    INSERT INTO notification.notificaciones(usuario_id, orden_id, tipo, mensaje)
    SELECT tecnico_id, p_orden, 'oferta_orden',
           'Tienes una nueva solicitud compatible con tu cobertura.'
    FROM insertadas;

    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END $$ LANGUAGE plpgsql;

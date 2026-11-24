-- V23: match por ofertas, moderación de chat, disputas y auditoría unificada.
--
-- La v1 ya traía la tabla de ofertas y la aceptación atómica, pero ninguna
-- función generaba la oferta: el técnico "tomaba" la solicitud desde el panel.
-- Esta migración agrega el despacho real a los técnicos compatibles, sin
-- duplicar reglas en Java ni inventar precios.

-- =============================================================================
-- 1. MATCH: despacho de ofertas a técnicos compatibles
-- =============================================================================

-- Crea hasta p_limite ofertas para una orden en estado `solicitado`.
-- Candidatos: técnico activo y aprobado, disponible, sin otra orden abierta,
-- con la especialidad de la categoría y con cobertura que contiene el punto.
-- Orden: distancia real (si la posición es reciente), reputación y antigüedad.
-- Devuelve la cantidad de ofertas nuevas.
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
    -- Solo se despacha mientras la orden siga libre.
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

-- Expira las ofertas vencidas y vuelve a despachar las órdenes que se quedaron
-- sin ofertas pendientes, con un tope de 3 rondas por orden (18 ofertas).
-- La llama el planificador de la aplicación cada 30 segundos.
CREATE OR REPLACE FUNCTION orders.mantener_ofertas() RETURNS INT AS $$
DECLARE
    v_n INT := 0;
    v_id BIGINT;
BEGIN
    PERFORM orders.expirar_ofertas();
    FOR v_id IN
        SELECT o.id
        FROM orders.ordenes_servicio o
        WHERE o.estado = 'solicitado'
          AND o.tecnico_id IS NULL
          AND o.creado_en > clock_timestamp() - interval '15 minutes'
          AND NOT EXISTS (SELECT 1 FROM orders.ofertas_orden f
                          WHERE f.orden_id = o.id
                            AND f.estado = 'enviada'
                            AND f.expira_en > clock_timestamp())
          AND (SELECT count(*) FROM orders.ofertas_orden f WHERE f.orden_id = o.id) < 18
        ORDER BY o.creado_en
        LIMIT 50
    LOOP
        v_n := v_n + orders.generar_ofertas(v_id, 6, 2);
    END LOOP;
    RETURN v_n;
END $$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. MODERACIÓN REAL DE CHAT
-- =============================================================================
-- `chat.mensajes.contiene_contacto` existía desde la v1 pero nada la marcaba.
-- Detecta teléfonos bolivianos, correos, enlaces y menciones a mensajería.
CREATE OR REPLACE FUNCTION chat.marcar_contacto() RETURNS TRIGGER AS $$
BEGIN
    NEW.contiene_contacto := NEW.tipo = 'texto' AND (
        NEW.contenido ~* '(?:\+?591[\s.-]?)?[67][0-9]{3}[\s.-]?[0-9]{4}'
        OR NEW.contenido ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
        OR NEW.contenido ~* '(?:https?://|www\.)'
        OR NEW.contenido ~* '\m(?:whats?app|wsp|telegram|facebook|instagram|tiktok)\M'
        OR NEW.contenido ~* '(?:[0-9][\s.-]?){8,}'
    );
    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_marcar_contacto ON chat.mensajes;
CREATE TRIGGER tr_marcar_contacto
BEFORE INSERT OR UPDATE OF contenido ON chat.mensajes
FOR EACH ROW EXECUTE FUNCTION chat.marcar_contacto();

-- Clasifica los mensajes ya guardados (no cambia su texto ni su autor).
UPDATE chat.mensajes SET contenido = contenido;

CREATE INDEX IF NOT EXISTS idx_mensajes_contacto
    ON chat.mensajes(enviado_en DESC)
    WHERE contiene_contacto;

-- Registro de revisión: evita que la cola de moderación se vuelva infinita y
-- deja constancia de quién revisó. No bloquea cuentas ni borra mensajes.
CREATE TABLE IF NOT EXISTS admin_svc.moderacion_mensajes (
    mensaje_id   BIGINT PRIMARY KEY REFERENCES chat.mensajes(id) ON DELETE CASCADE,
    revisado_por BIGINT NOT NULL REFERENCES identity.usuarios(id),
    decision     TEXT NOT NULL CHECK (decision IN ('sin_accion', 'advertencia')),
    nota         TEXT CHECK (nota IS NULL OR length(btrim(nota)) BETWEEN 5 AND 500),
    revisado_en  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION admin_svc.revisar_mensaje(
    p_mensaje BIGINT, p_decision TEXT, p_nota TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE v_actor BIGINT := orders.usuario_actual();
BEGIN
    PERFORM 1 FROM identity.usuarios
        WHERE id = v_actor AND rol = 'administrador' AND activo AND eliminado_en IS NULL
        FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no puede moderar mensajes.' USING ERRCODE = '42501';
    END IF;
    IF p_decision IS NULL OR p_decision NOT IN ('sin_accion', 'advertencia') THEN
        RAISE EXCEPTION 'Selecciona una decisión de moderación válida.';
    END IF;
    IF p_nota IS NOT NULL AND length(btrim(p_nota)) NOT BETWEEN 5 AND 500 THEN
        RAISE EXCEPTION 'La nota debe tener entre 5 y 500 caracteres.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM chat.mensajes WHERE id = p_mensaje) THEN
        RAISE EXCEPTION 'El mensaje no está disponible.' USING ERRCODE = 'P0424';
    END IF;
    INSERT INTO admin_svc.moderacion_mensajes(mensaje_id, revisado_por, decision, nota)
    VALUES (p_mensaje, v_actor, p_decision, NULLIF(btrim(p_nota), ''))
    ON CONFLICT (mensaje_id) DO UPDATE
        SET revisado_por = EXCLUDED.revisado_por, decision = EXCLUDED.decision,
            nota = EXCLUDED.nota, revisado_en = clock_timestamp();
END $$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. DISPUTAS
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_svc.abrir_disputa(p_orden BIGINT, p_motivo TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_actor BIGINT := orders.usuario_actual();
    v_o orders.ordenes_servicio%ROWTYPE;
    v_contra BIGINT;
    v_id BIGINT;
BEGIN
    PERFORM 1 FROM identity.usuarios
        WHERE id = v_actor AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id = p_orden FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden no está disponible.' USING ERRCODE = 'P0424';
    END IF;
    IF v_actor <> v_o.cliente_id AND v_actor IS DISTINCT FROM v_o.tecnico_id THEN
        RAISE EXCEPTION 'No participas en esta orden.' USING ERRCODE = '42501';
    END IF;
    IF v_o.tecnico_id IS NULL THEN
        RAISE EXCEPTION 'La orden todavía no tiene contraparte.' USING ERRCODE = 'P0409';
    END IF;
    IF v_o.estado NOT IN ('finalizado', 'cancelado') THEN
        RAISE EXCEPTION 'Solo puedes abrir una disputa de una orden cerrada.' USING ERRCODE = 'P0409';
    END IF;
    IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 10 AND 1000 THEN
        RAISE EXCEPTION 'Describe el motivo en entre 10 y 1000 caracteres.';
    END IF;
    IF EXISTS (SELECT 1 FROM admin_svc.disputas
               WHERE orden_id = p_orden AND abierta_por_id = v_actor AND estado <> 'resuelta') THEN
        RAISE EXCEPTION 'Ya tienes una disputa abierta para esta orden.' USING ERRCODE = 'P0409';
    END IF;

    v_contra := CASE WHEN v_actor = v_o.cliente_id THEN v_o.tecnico_id ELSE v_o.cliente_id END;

    INSERT INTO admin_svc.disputas(orden_id, abierta_por_id, contra_usuario_id, motivo)
    VALUES (p_orden, v_actor, v_contra, btrim(p_motivo))
    RETURNING id INTO v_id;

    INSERT INTO notification.notificaciones(usuario_id, orden_id, tipo, mensaje)
    VALUES (v_contra, p_orden, 'disputa', 'Se abrió una disputa sobre tu servicio.');
    INSERT INTO notification.notificaciones(usuario_id, orden_id, tipo, mensaje)
    SELECT u.id, p_orden, 'disputa', 'Hay una nueva disputa por revisar.'
    FROM identity.usuarios u
    WHERE u.rol = 'administrador' AND u.activo AND u.eliminado_en IS NULL;

    RETURN v_id;
END $$ LANGUAGE plpgsql;

-- Revisión administrativa: abierta -> en_revision -> resuelta.
CREATE OR REPLACE FUNCTION admin_svc.revisar_disputa(
    p_disputa BIGINT, p_estado TEXT, p_resolucion TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_actor BIGINT := orders.usuario_actual();
    v_d admin_svc.disputas%ROWTYPE;
BEGIN
    PERFORM 1 FROM identity.usuarios
        WHERE id = v_actor AND rol = 'administrador' AND activo AND eliminado_en IS NULL
        FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no puede revisar disputas.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_d FROM admin_svc.disputas WHERE id = p_disputa FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La disputa no está disponible.' USING ERRCODE = 'P0424';
    END IF;
    IF p_estado IS NULL OR p_estado NOT IN ('en_revision', 'resuelta') THEN
        RAISE EXCEPTION 'Selecciona un estado válido para la disputa.';
    END IF;
    IF v_d.estado = 'resuelta' THEN
        RAISE EXCEPTION 'La disputa ya está resuelta.' USING ERRCODE = 'P0409';
    END IF;
    IF p_estado = 'en_revision' AND v_d.estado <> 'abierta' THEN
        RAISE EXCEPTION 'La disputa ya está en revisión.' USING ERRCODE = 'P0409';
    END IF;
    IF p_estado = 'resuelta' THEN
        IF p_resolucion IS NULL OR length(btrim(p_resolucion)) NOT BETWEEN 10 AND 2000 THEN
            RAISE EXCEPTION 'Escribe una resolución de entre 10 y 2000 caracteres.';
        END IF;
        UPDATE admin_svc.disputas
           SET estado = 'resuelta', resolucion = btrim(p_resolucion),
               administrador_id = v_actor, resuelta_en = clock_timestamp()
         WHERE id = p_disputa;
    ELSE
        UPDATE admin_svc.disputas
           SET estado = 'en_revision', administrador_id = v_actor
         WHERE id = p_disputa;
    END IF;

    INSERT INTO notification.notificaciones(usuario_id, orden_id, tipo, mensaje)
    VALUES (v_d.abierta_por_id, v_d.orden_id, 'disputa',
            CASE WHEN p_estado = 'resuelta' THEN 'Tu disputa fue resuelta.' ELSE 'Tu disputa está en revisión.' END),
           (v_d.contra_usuario_id, v_d.orden_id, 'disputa',
            CASE WHEN p_estado = 'resuelta' THEN 'La disputa de tu servicio fue resuelta.' ELSE 'La disputa de tu servicio está en revisión.' END);

    RETURN p_estado;
END $$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. AUDITORÍA UNIFICADA (solo lectura)
-- =============================================================================
-- Unifica las bitácoras existentes sin inventar actores: cuando la tabla no
-- registra quién actuó, el actor queda NULL y la interfaz lo muestra así.
CREATE OR REPLACE VIEW admin_svc.auditoria_unificada AS
SELECT 'perfil'::text AS origen, a.id, a.usuario_id AS sujeto_id, NULL::bigint AS actor_id,
       a.accion, NULL::text AS motivo,
       jsonb_build_object('antes', a.antes, 'despues', a.despues) AS detalle,
       a.creado_en
FROM identity.auditoria_perfil a
UNION ALL
SELECT 'disponibilidad', a.id, a.tecnico_id, a.tecnico_id, 'disponibilidad', NULL,
       jsonb_build_object('antes', a.antes, 'despues', a.despues), a.creado_en
FROM identity.auditoria_disponibilidad a
UNION ALL
SELECT 'google', a.id, a.usuario_id, a.usuario_id, a.accion, NULL, '{}'::jsonb, a.creado_en
FROM identity.auditoria_google a
UNION ALL
SELECT 'usuarios', a.id, a.usuario_id, a.admin_id, a.accion, a.motivo,
       jsonb_build_object('antes', a.antes, 'despues', a.despues), a.creado_en
FROM admin_svc.auditoria_usuarios a
UNION ALL
SELECT 'catalogo', a.id, a.categoria_id, a.admin_id, a.accion, NULL,
       jsonb_build_object('antes', a.antes, 'despues', a.despues), a.creado_en
FROM admin_svc.auditoria_catalogo a
UNION ALL
SELECT 'cobertura', a.id, a.solicitud_id, a.actor_id, a.accion, NULL,
       jsonb_build_object('antes', a.antes, 'despues', a.despues), a.creado_en
FROM geo.auditoria_cobertura a
UNION ALL
SELECT 'orden', a.id, a.orden_id, a.usuario_id,
       coalesce(a.estado_nuevo::text, 'transicion'), a.observacion,
       jsonb_build_object('antes', a.estado_anterior::text, 'despues', a.estado_nuevo::text),
       a.registrado_en
FROM orders.transiciones_estado a;

CREATE INDEX IF NOT EXISTS idx_auditoria_perfil_fecha ON identity.auditoria_perfil(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_disponibilidad_fecha ON identity.auditoria_disponibilidad(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_google_fecha ON identity.auditoria_google(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_catalogo_fecha ON admin_svc.auditoria_catalogo(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_cobertura_fecha ON geo.auditoria_cobertura(creado_en DESC);

-- Una empresa prestadora, técnicos incorporados por coordinación y clientes propios.
-- No se modifican estados históricos: pausa y conformidad son dimensiones de la atención.
CREATE TABLE orders.busquedas_servicio (
    orden_id BIGINT PRIMARY KEY REFERENCES orders.ordenes_servicio(id),
    estado TEXT NOT NULL DEFAULT 'buscando'
        CHECK (estado IN ('buscando','sin_disponibilidad','asignada','cancelada')),
    hasta TIMESTAMPTZ NOT NULL,
    intento INT NOT NULL DEFAULT 1
);
INSERT INTO orders.busquedas_servicio(orden_id,hasta)
SELECT id,creado_en+interval '15 minutes' FROM orders.ordenes_servicio WHERE estado='solicitado';

CREATE TABLE orders.atenciones (
    orden_id BIGINT PRIMARY KEY REFERENCES orders.ordenes_servicio(id),
    revision BIGINT NOT NULL DEFAULT 0,
    codigo_hash TEXT,
    codigo_expira TIMESTAMPTZ,
    codigo_emitido TIMESTAMPTZ,
    codigo_dia DATE,
    codigos_dia INT NOT NULL DEFAULT 0,
    intentos_codigo INT NOT NULL DEFAULT 0,
    llegada_verificada_en TIMESTAMPTZ,
    pausa_motivo TEXT,
    reanudar_en TIMESTAMPTZ,
    incidencia TEXT,
    trabajo_realizado TEXT,
    evidencia_url TEXT,
    entregado_en TIMESTAMPTZ,
    conformidad TEXT CHECK (conformidad IN ('pendiente','conforme','observado','resuelto_coordinacion')),
    respuesta_cliente TEXT,
    proximo_mantenimiento DATE
);
CREATE TABLE orders.eventos_atencion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_id BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    actor_id BIGINT REFERENCES identity.usuarios(id),
    accion TEXT NOT NULL,
    motivo TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_eventos_atencion ON orders.eventos_atencion(orden_id,id DESC);

CREATE FUNCTION orders.iniciar_control_atencion() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO orders.atenciones(orden_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
    INSERT INTO orders.busquedas_servicio(orden_id,hasta)
    VALUES(NEW.id,clock_timestamp()+interval '15 minutes') ON CONFLICT DO NOTHING;
    RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_control_atencion AFTER INSERT ON orders.ordenes_servicio
FOR EACH ROW EXECUTE FUNCTION orders.iniciar_control_atencion();
INSERT INTO orders.atenciones(orden_id) SELECT id FROM orders.ordenes_servicio ON CONFLICT DO NOTHING;

-- Orden único de bloqueos: cuenta -> perfil técnico -> orden -> atención.
CREATE FUNCTION orders.bloquear_atencion(p_orden BIGINT,p_revision BIGINT DEFAULT NULL)
RETURNS orders.ordenes_servicio AS $$
DECLARE v_o orders.ordenes_servicio; v_actor BIGINT:=orders.usuario_actual(); v_rol TEXT; v_rev BIGINT;
BEGIN
    SELECT rol::text INTO v_rol FROM identity.usuarios
    WHERE id=v_actor AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501'; END IF;
    IF v_rol='tecnico' THEN PERFORM identity.tecnico_operativo(); END IF;
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden FOR UPDATE;
    IF NOT FOUND OR (v_rol<>'administrador' AND v_actor<>v_o.cliente_id
        AND v_actor IS DISTINCT FROM v_o.tecnico_id) THEN
        RAISE EXCEPTION 'La atención no está disponible.' USING ERRCODE='P0425';
    END IF;
    SELECT revision INTO v_rev FROM orders.atenciones WHERE orden_id=p_orden FOR UPDATE;
    IF p_revision IS NOT NULL AND p_revision<>v_rev THEN
        RAISE EXCEPTION 'La atención cambió. Actualiza antes de continuar.' USING ERRCODE='P0409';
    END IF;
    RETURN v_o;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.registrar_evento_atencion(p_orden BIGINT,p_accion TEXT,p_motivo TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE orders.atenciones SET revision=revision+1 WHERE orden_id=p_orden;
    INSERT INTO orders.eventos_atencion(orden_id,actor_id,accion,motivo)
    VALUES(p_orden,orders.usuario_actual(),p_accion,p_motivo);
    INSERT INTO notification.notificaciones(usuario_id,orden_id,tipo,mensaje)
    SELECT cliente_id,id,'cambio_estado',p_motivo FROM orders.ordenes_servicio
    WHERE id=p_orden AND cliente_id IS DISTINCT FROM orders.usuario_actual()
    UNION ALL
    SELECT tecnico_id,id,'cambio_estado',p_motivo FROM orders.ordenes_servicio
    WHERE id=p_orden AND tecnico_id IS NOT NULL AND tecnico_id IS DISTINCT FROM orders.usuario_actual();
END $$ LANGUAGE plpgsql;

-- Serializar también dos ofertas diferentes aceptadas por el MISMO técnico.
ALTER FUNCTION orders.aceptar_oferta(BIGINT,BIGINT) RENAME TO aceptar_oferta_base_v1;
CREATE FUNCTION orders.aceptar_oferta(p_oferta_id BIGINT,p_tecnico_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE v_o orders.ordenes_servicio; v_orden BIGINT; v_gano BOOLEAN;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_tecnico_id THEN
        RAISE EXCEPTION 'La aceptación debe realizarla el técnico destinatario.' USING ERRCODE='42501';
    END IF;
    PERFORM identity.tecnico_operativo();
    SELECT orden_id INTO v_orden FROM orders.ofertas_orden WHERE id=p_oferta_id AND tecnico_id=p_tecnico_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=v_orden FOR UPDATE;
    IF v_o.tecnico_id=p_tecnico_id AND EXISTS(SELECT 1 FROM orders.ofertas_orden
        WHERE id=p_oferta_id AND estado='aceptada') THEN RETURN TRUE; END IF;
    IF v_o.estado<>'solicitado' OR v_o.tecnico_id IS NOT NULL
        OR EXISTS(SELECT 1 FROM orders.ordenes_servicio WHERE tecnico_id=p_tecnico_id
            AND estado NOT IN ('finalizado','cancelado'))
        OR NOT EXISTS(SELECT 1 FROM identity.perfiles_tecnico
            WHERE usuario_id=p_tecnico_id AND disponibilidad='disponible')
        OR NOT EXISTS(SELECT 1 FROM identity.usuarios WHERE id=v_o.cliente_id AND activo AND eliminado_en IS NULL)
        OR NOT EXISTS(SELECT 1 FROM orders.categorias_servicio WHERE id=v_o.categoria_id AND activa)
        OR NOT EXISTS(SELECT 1 FROM identity.tecnico_especialidades WHERE tecnico_id=p_tecnico_id AND categoria_id=v_o.categoria_id)
        OR NOT EXISTS(SELECT 1 FROM geo.zonas_cobertura WHERE tecnico_id=p_tecnico_id AND activo
            AND ST_Covers(poligono::geometry,v_o.ubicacion_cliente::geometry))
        OR EXISTS(SELECT 1 FROM orders.busquedas_servicio WHERE orden_id=v_orden
            AND (estado<>'buscando' OR hasta<=clock_timestamp())) THEN RETURN FALSE;
    END IF;
    v_gano:=orders.aceptar_oferta_base_v1(p_oferta_id,p_tecnico_id);
    IF v_gano THEN
        UPDATE orders.busquedas_servicio SET estado='asignada' WHERE orden_id=v_orden;
        UPDATE orders.ofertas_orden SET estado='cerrada',respondida_en=clock_timestamp()
        WHERE tecnico_id=p_tecnico_id AND orden_id<>v_orden AND estado='enviada';
        PERFORM orders.registrar_evento_atencion(v_orden,'asignacion','Un técnico de la empresa aceptó la atención.');
    END IF;
    RETURN v_gano;
END $$ LANGUAGE plpgsql;

-- La posición solo se utiliza si existe; no se exige GPS fuera de un trayecto consentido.
CREATE OR REPLACE FUNCTION orders.generar_ofertas(p_orden BIGINT,p_limite INT DEFAULT 6,p_minutos INT DEFAULT 2)
RETURNS INT AS $$
DECLARE v_o orders.ordenes_servicio; v_n INT;
BEGIN
    IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 20 OR p_minutos IS NULL
        OR p_minutos NOT BETWEEN 1 AND 15 THEN RAISE EXCEPTION 'Los parámetros de asignación no son válidos.'; END IF;
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden FOR UPDATE;
    IF NOT FOUND OR v_o.estado<>'solicitado' OR v_o.tecnico_id IS NOT NULL
        OR EXISTS(SELECT 1 FROM orders.busquedas_servicio WHERE orden_id=p_orden
            AND (estado<>'buscando' OR hasta<=clock_timestamp())) THEN RETURN 0; END IF;
    WITH candidatos AS (
        SELECT p.usuario_id,CASE WHEN ub.actualizado_en>clock_timestamp()-interval '30 seconds'
            THEN ST_Distance(ub.punto,v_o.ubicacion_cliente) END distancia,
            coalesce(ir.indice_general,50) indice,
            (SELECT max(asignado_en) FROM orders.ordenes_servicio WHERE tecnico_id=p.usuario_id) ultima
        FROM identity.perfiles_tecnico p JOIN identity.usuarios u ON u.id=p.usuario_id
        LEFT JOIN geo.ubicacion_actual ub ON ub.tecnico_id=p.usuario_id
        LEFT JOIN reputation.indices_reputacion ir ON ir.tecnico_id=p.usuario_id
        WHERE u.activo AND u.eliminado_en IS NULL AND p.estado_validacion='aprobado'
            AND p.disponibilidad='disponible'
            AND EXISTS(SELECT 1 FROM identity.tecnico_especialidades e
                WHERE e.tecnico_id=p.usuario_id AND e.categoria_id=v_o.categoria_id)
            AND EXISTS(SELECT 1 FROM geo.zonas_cobertura z WHERE z.tecnico_id=p.usuario_id AND z.activo
                AND ST_Covers(z.poligono::geometry,v_o.ubicacion_cliente::geometry))
            AND NOT EXISTS(SELECT 1 FROM orders.ordenes_servicio a WHERE a.tecnico_id=p.usuario_id
                AND a.estado NOT IN ('finalizado','cancelado'))
            AND NOT EXISTS(SELECT 1 FROM orders.ofertas_orden f WHERE f.orden_id=p_orden AND f.tecnico_id=p.usuario_id)
        ORDER BY distancia NULLS LAST,indice DESC,ultima NULLS FIRST,p.usuario_id LIMIT p_limite
    ), nuevas AS (
        INSERT INTO orders.ofertas_orden(orden_id,tecnico_id,distancia_metros,expira_en)
        SELECT p_orden,usuario_id,distancia,clock_timestamp()+p_minutos*interval '1 minute' FROM candidatos
        ON CONFLICT DO NOTHING RETURNING tecnico_id
    )
    INSERT INTO notification.notificaciones(usuario_id,orden_id,tipo,mensaje)
    SELECT tecnico_id,p_orden,'oferta_orden','Tienes una atención compatible con tu especialidad y zona.' FROM nuevas;
    GET DIAGNOSTICS v_n=ROW_COUNT;
    RETURN v_n;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION orders.mantener_ofertas() RETURNS INT AS $$
DECLARE v_id BIGINT; v_n INT:=0;
BEGIN
    IF NOT pg_try_advisory_xact_lock(260026) THEN RETURN 0; END IF;
    PERFORM orders.expirar_ofertas();
    FOR v_id IN SELECT o.id FROM orders.ordenes_servicio o
        JOIN orders.busquedas_servicio b ON b.orden_id=o.id
        WHERE o.estado='solicitado' AND b.estado='buscando'
        AND (b.hasta<=clock_timestamp() OR (SELECT count(*) FROM orders.ofertas_orden WHERE orden_id=o.id)>=18)
        AND NOT EXISTS(SELECT 1 FROM orders.ofertas_orden WHERE orden_id=o.id
            AND estado='enviada' AND expira_en>clock_timestamp())
        ORDER BY o.id LIMIT 50 FOR UPDATE OF o SKIP LOCKED
    LOOP
        UPDATE orders.busquedas_servicio SET estado='sin_disponibilidad' WHERE orden_id=v_id;
        PERFORM orders.registrar_evento_atencion(v_id,'sin_disponibilidad',
            'La búsqueda terminó sin asignación. Puedes pedir un nuevo intento o contactar a coordinación.');
    END LOOP;
    FOR v_id IN SELECT o.id FROM orders.ordenes_servicio o
        JOIN orders.busquedas_servicio b ON b.orden_id=o.id
        WHERE o.estado='solicitado' AND b.estado='buscando' AND b.hasta>clock_timestamp()
        AND NOT EXISTS(SELECT 1 FROM orders.ofertas_orden WHERE orden_id=o.id
            AND estado='enviada' AND expira_en>clock_timestamp())
        ORDER BY o.id LIMIT 50 FOR UPDATE OF o SKIP LOCKED
    LOOP v_n:=v_n+orders.generar_ofertas(v_id); END LOOP;
    RETURN v_n;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.reintentar_busqueda(p_orden BIGINT,p_revision BIGINT) RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden,p_revision);
BEGIN
    IF v_o.cliente_id<>orders.usuario_actual() OR v_o.estado<>'solicitado' THEN
        RAISE EXCEPTION 'Solo puedes reintentar una solicitud propia sin asignación.' USING ERRCODE='P0409'; END IF;
    IF NOT EXISTS(SELECT 1 FROM orders.busquedas_servicio WHERE orden_id=p_orden
        AND estado='sin_disponibilidad' AND intento<3) THEN
        RAISE EXCEPTION 'La búsqueda sigue activa o alcanzó tres intentos. Solicita ayuda de coordinación.' USING ERRCODE='P0409'; END IF;
    UPDATE orders.busquedas_servicio SET estado='buscando',hasta=clock_timestamp()+interval '15 minutes',intento=intento+1
    WHERE orden_id=p_orden;
    PERFORM orders.registrar_evento_atencion(p_orden,'reintento','Se inició otro intento con técnicos que aún no recibieron la solicitud.');
    PERFORM orders.generar_ofertas(p_orden);
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.emitir_codigo_llegada(p_orden BIGINT) RETURNS TEXT AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden); v_a orders.atenciones; v_codigo TEXT;
BEGIN
    IF v_o.cliente_id<>orders.usuario_actual() OR v_o.estado<>'en_camino' THEN
        RAISE EXCEPTION 'Solo el cliente de una atención en camino puede emitir el código.' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_a FROM orders.atenciones WHERE orden_id=p_orden;
    IF v_a.codigo_emitido>clock_timestamp()-interval '60 seconds' THEN
        RAISE EXCEPTION 'Espera un minuto antes de generar otro código.' USING ERRCODE='P0409'; END IF;
    IF v_a.codigo_dia=(clock_timestamp() AT TIME ZONE 'America/La_Paz')::date AND v_a.codigos_dia>=5 THEN
        RAISE EXCEPTION 'Alcanzaste cinco códigos por día. Contacta a coordinación.' USING ERRCODE='P0409'; END IF;
    v_codigo:=lpad((get_byte(gen_random_bytes(1),0)*65536+get_byte(gen_random_bytes(1),0)*256+
        get_byte(gen_random_bytes(1),0))::text,8,'0');
    -- Ocho cifras, aleatoriedad criptográfica; solo se conserva el hash.
    UPDATE orders.atenciones SET codigo_hash=encode(digest(v_codigo,'sha256'),'hex'),
        codigo_expira=clock_timestamp()+interval '10 minutes',codigo_emitido=clock_timestamp(),
        intentos_codigo=0,codigo_dia=(clock_timestamp() AT TIME ZONE 'America/La_Paz')::date,
        codigos_dia=CASE WHEN codigo_dia=(clock_timestamp() AT TIME ZONE 'America/La_Paz')::date
            THEN codigos_dia+1 ELSE 1 END WHERE orden_id=p_orden;
    RETURN v_codigo;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.verificar_llegada(p_orden BIGINT,p_codigo TEXT) RETURNS BOOLEAN AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden); v_a orders.atenciones;
BEGIN
    IF v_o.tecnico_id IS DISTINCT FROM orders.usuario_actual() THEN
        RAISE EXCEPTION 'Solo el técnico asignado puede confirmar el encuentro.' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_a FROM orders.atenciones WHERE orden_id=p_orden;
    IF v_a.llegada_verificada_en IS NOT NULL THEN RETURN TRUE; END IF;
    IF v_o.estado<>'en_camino' THEN RETURN FALSE; END IF;
    IF v_a.codigo_hash IS NULL OR v_a.codigo_expira<=clock_timestamp() OR v_a.intentos_codigo>=5 THEN RETURN FALSE; END IF;
    UPDATE orders.atenciones SET intentos_codigo=intentos_codigo+1 WHERE orden_id=p_orden;
    IF p_codigo IS NULL OR encode(digest(p_codigo,'sha256'),'hex')<>v_a.codigo_hash THEN RETURN FALSE; END IF;
    UPDATE orders.atenciones SET llegada_verificada_en=clock_timestamp(),codigo_hash=NULL,codigo_expira=NULL WHERE orden_id=p_orden;
    UPDATE orders.ordenes_servicio SET estado='en_diagnostico' WHERE id=p_orden;
    PERFORM orders.registrar_evento_atencion(p_orden,'llegada','El encuentro fue confirmado con el código del cliente.');
    RETURN TRUE;
END $$ LANGUAGE plpgsql;

ALTER FUNCTION orders.avanzar_servicio_propio(BIGINT,TEXT) RENAME TO avanzar_servicio_base_v21;
CREATE FUNCTION orders.avanzar_servicio_propio(p_orden BIGINT,p_accion TEXT) RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden); v_a orders.atenciones;
BEGIN
    SELECT * INTO v_a FROM orders.atenciones WHERE orden_id=p_orden;
    IF v_a.pausa_motivo IS NOT NULL OR v_a.entregado_en IS NOT NULL THEN
        RAISE EXCEPTION 'La atención está pausada o pendiente de conformidad.' USING ERRCODE='P0409'; END IF;
    IF p_accion='llegada' AND v_a.llegada_verificada_en IS NULL THEN
        RAISE EXCEPTION 'Confirma la llegada con el código del cliente o solicita ayuda de coordinación.' USING ERRCODE='P0409'; END IF;
    IF p_accion='finalizar' THEN
        RAISE EXCEPTION 'Registra el trabajo y solicita la conformidad del cliente.' USING ERRCODE='P0409'; END IF;
    PERFORM orders.avanzar_servicio_base_v21(p_orden,p_accion);
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.gestionar_incidencia(p_orden BIGINT,p_revision BIGINT,p_accion TEXT,p_motivo TEXT,p_fecha TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden,p_revision); v_tecnico BOOLEAN;
BEGIN
    IF v_o.estado IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'La atención está cerrada.' USING ERRCODE='P0409'; END IF;
    IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 10 AND 1000 THEN
        RAISE EXCEPTION 'Escribe un motivo de entre 10 y 1000 caracteres.'; END IF;
    v_tecnico:=v_o.tecnico_id=orders.usuario_actual();
    IF EXISTS(SELECT 1 FROM orders.atenciones WHERE orden_id=p_orden AND entregado_en IS NOT NULL) THEN
        RAISE EXCEPTION 'La entrega ya está pendiente de revisión.' USING ERRCODE='P0409'; END IF;
    IF p_accion='pausar' THEN
        IF NOT coalesce(v_tecnico,FALSE) OR v_o.estado NOT IN ('en_diagnostico','en_reparacion')
            OR p_fecha IS NULL OR p_fecha<=clock_timestamp() OR p_fecha>clock_timestamp()+interval '30 days' THEN
            RAISE EXCEPTION 'Solo el técnico puede pausar la atención con una continuación prevista en los próximos 30 días.' USING ERRCODE='P0409'; END IF;
        UPDATE orders.atenciones SET pausa_motivo=btrim(p_motivo),reanudar_en=p_fecha WHERE orden_id=p_orden;
    ELSIF p_accion='reanudar' THEN
        IF NOT coalesce(v_tecnico,FALSE) OR NOT EXISTS(SELECT 1 FROM orders.atenciones WHERE orden_id=p_orden AND pausa_motivo IS NOT NULL) THEN
            RAISE EXCEPTION 'Solo el técnico puede reanudar una atención pausada.' USING ERRCODE='P0409'; END IF;
        UPDATE orders.atenciones SET pausa_motivo=NULL,reanudar_en=NULL WHERE orden_id=p_orden;
    ELSIF p_accion IN ('solicitar_cancelacion','cliente_ausente','solicitar_coordinacion') THEN
        IF p_accion='cliente_ausente' AND (NOT coalesce(v_tecnico,FALSE) OR v_o.estado<>'en_camino') THEN
            RAISE EXCEPTION 'La ausencia solo la registra el técnico durante el trayecto.' USING ERRCODE='P0409'; END IF;
        UPDATE orders.atenciones SET incidencia=p_accion||': '||btrim(p_motivo) WHERE orden_id=p_orden;
    ELSE RAISE EXCEPTION 'Selecciona una acción permitida.'; END IF;
    PERFORM orders.registrar_evento_atencion(p_orden,p_accion,btrim(p_motivo));
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.entregar_trabajo(p_orden BIGINT,p_revision BIGINT,p_trabajo TEXT,p_evidencia TEXT,p_mantenimiento DATE)
RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden,p_revision);
BEGIN
    IF v_o.tecnico_id IS DISTINCT FROM orders.usuario_actual() OR v_o.estado<>'en_reparacion' THEN
        RAISE EXCEPTION 'Solo el técnico de una reparación puede registrar la entrega.' USING ERRCODE='P0409'; END IF;
    IF p_trabajo IS NULL OR length(btrim(p_trabajo)) NOT BETWEEN 20 AND 2000
        OR p_evidencia IS NULL OR p_evidencia !~ '^/perfiles/[a-f0-9-]{36}\.(jpg|jpeg|png|pdf)$' THEN
        RAISE EXCEPTION 'Describe el trabajo en entre 20 y 2000 caracteres y adjunta una evidencia privada.'; END IF;
    IF p_mantenimiento IS NOT NULL AND (p_mantenimiento<=(clock_timestamp() AT TIME ZONE 'America/La_Paz')::date
        OR p_mantenimiento>(clock_timestamp() AT TIME ZONE 'America/La_Paz')::date+730) THEN
        RAISE EXCEPTION 'El próximo mantenimiento debe estar dentro de los próximos dos años.'; END IF;
    IF EXISTS(SELECT 1 FROM orders.atenciones WHERE orden_id=p_orden AND (pausa_motivo IS NOT NULL OR entregado_en IS NOT NULL))
        OR EXISTS(SELECT 1 FROM billing.cotizaciones WHERE orden_id=p_orden AND estado='enviada')
        OR NOT EXISTS(SELECT 1 FROM billing.cotizaciones WHERE orden_id=p_orden AND estado='aceptada') THEN
        RAISE EXCEPTION 'Reanuda la atención y confirma la autorización antes de entregar.' USING ERRCODE='P0409'; END IF;
    UPDATE orders.atenciones SET trabajo_realizado=btrim(p_trabajo),evidencia_url=p_evidencia,entregado_en=clock_timestamp(),
        conformidad='pendiente',proximo_mantenimiento=p_mantenimiento WHERE orden_id=p_orden;
    PERFORM orders.registrar_evento_atencion(p_orden,'entrega','El técnico registró el trabajo y solicitó tu conformidad.');
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.responder_entrega(p_orden BIGINT,p_revision BIGINT,p_conforme BOOLEAN,p_comentario TEXT)
RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden,p_revision);
BEGIN
    IF v_o.cliente_id<>orders.usuario_actual() OR v_o.estado<>'en_reparacion'
        OR NOT EXISTS(SELECT 1 FROM orders.atenciones WHERE orden_id=p_orden AND conformidad='pendiente') THEN
        RAISE EXCEPTION 'La entrega no está pendiente de tu conformidad.' USING ERRCODE='P0409'; END IF;
    IF p_conforme IS NULL OR p_comentario IS NULL OR length(btrim(p_comentario)) NOT BETWEEN 10 AND 1000 THEN
        RAISE EXCEPTION 'Confirma tu decisión y escribe entre 10 y 1000 caracteres.'; END IF;
    UPDATE orders.atenciones SET conformidad=CASE WHEN p_conforme THEN 'conforme' ELSE 'observado' END,
        respuesta_cliente=btrim(p_comentario),incidencia=CASE WHEN p_conforme THEN NULL ELSE 'Entrega observada: '||btrim(p_comentario) END
    WHERE orden_id=p_orden;
    IF p_conforme THEN UPDATE orders.ordenes_servicio SET estado='finalizado' WHERE id=p_orden; END IF;
    PERFORM orders.registrar_evento_atencion(p_orden,CASE WHEN p_conforme THEN 'conformidad' ELSE 'entrega_observada' END,btrim(p_comentario));
END $$ LANGUAGE plpgsql;

CREATE FUNCTION admin_svc.resolver_atencion(p_orden BIGINT,p_revision BIGINT,p_accion TEXT,p_motivo TEXT,p_fecha TIMESTAMPTZ)
RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio:=orders.bloquear_atencion(p_orden,p_revision);
BEGIN
    IF NOT EXISTS(SELECT 1 FROM identity.usuarios WHERE id=orders.usuario_actual() AND rol='administrador') THEN
        RAISE EXCEPTION 'Solo coordinación puede resolver esta incidencia.' USING ERRCODE='42501'; END IF;
    IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 10 AND 1000 THEN
        RAISE EXCEPTION 'Justifica la decisión en entre 10 y 1000 caracteres.'; END IF;
    IF v_o.estado IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'La atención está cerrada.' USING ERRCODE='P0409'; END IF;
    IF p_accion='cancelar' THEN
        UPDATE orders.ordenes_servicio SET estado='cancelado',motivo_cancelacion=btrim(p_motivo) WHERE id=p_orden;
        UPDATE orders.ofertas_orden SET estado='cerrada',respondida_en=clock_timestamp() WHERE orden_id=p_orden AND estado='enviada';
        UPDATE orders.busquedas_servicio SET estado='cancelada' WHERE orden_id=p_orden;
    ELSIF p_accion='llegada_justificada' AND v_o.estado='en_camino' THEN
        UPDATE orders.atenciones SET llegada_verificada_en=clock_timestamp(),codigo_hash=NULL,codigo_expira=NULL WHERE orden_id=p_orden;
        UPDATE orders.ordenes_servicio SET estado='en_diagnostico' WHERE id=p_orden;
    ELSIF p_accion='reprogramar' AND v_o.estado IN ('en_camino','en_diagnostico','en_reparacion') THEN
        IF p_fecha IS NULL OR p_fecha<=clock_timestamp() OR p_fecha>clock_timestamp()+interval '30 days' THEN
            RAISE EXCEPTION 'Indica una fecha futura dentro de 30 días.'; END IF;
        UPDATE orders.atenciones SET pausa_motivo=btrim(p_motivo),reanudar_en=p_fecha,incidencia=NULL WHERE orden_id=p_orden;
    ELSIF p_accion='cerrar_entrega' AND v_o.estado='en_reparacion' AND EXISTS(
        SELECT 1 FROM orders.atenciones WHERE orden_id=p_orden AND entregado_en IS NOT NULL
            AND (conformidad='observado' OR entregado_en<clock_timestamp()-interval '48 hours')) THEN
        UPDATE orders.atenciones SET conformidad='resuelto_coordinacion',incidencia=NULL WHERE orden_id=p_orden;
        UPDATE orders.ordenes_servicio SET estado='finalizado' WHERE id=p_orden;
    ELSE RAISE EXCEPTION 'La acción no corresponde a la etapa actual.' USING ERRCODE='P0409'; END IF;
    PERFORM orders.registrar_evento_atencion(p_orden,'coordinacion_'||p_accion,btrim(p_motivo));
END $$ LANGUAGE plpgsql;

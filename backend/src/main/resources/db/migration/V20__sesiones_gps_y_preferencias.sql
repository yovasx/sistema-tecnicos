-- Sesiones GPS revocables por orden. V18/V19 permanecen inmutables.
ALTER TABLE identity.preferencias_cliente ADD COLUMN revision BIGINT NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION identity.guardar_preferencias(p_id BIGINT,p_email BOOLEAN,p_push BOOLEAN,p_ubicacion BOOLEAN)
RETURNS VOID AS $$
DECLARE v_antes JSONB; v_despues JSONB;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Solo puedes cambiar tus propias preferencias.' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM identity.usuarios WHERE id=p_id AND activo AND eliminado_en IS NULL
        AND rol='cliente' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501'; END IF;
    SELECT to_jsonb(p) INTO v_antes FROM identity.preferencias_cliente p WHERE usuario_id=p_id;
    INSERT INTO identity.preferencias_cliente(usuario_id,notificaciones_email,notificaciones_push,compartir_ubicacion,revision)
        VALUES(p_id,COALESCE(p_email,true),COALESCE(p_push,false),COALESCE(p_ubicacion,true),1)
        ON CONFLICT(usuario_id) DO UPDATE SET notificaciones_email=EXCLUDED.notificaciones_email,
            notificaciones_push=EXCLUDED.notificaciones_push,compartir_ubicacion=EXCLUDED.compartir_ubicacion,
            actualizado_en=clock_timestamp(),revision=identity.preferencias_cliente.revision+1;
    SELECT to_jsonb(p) INTO v_despues FROM identity.preferencias_cliente p WHERE usuario_id=p_id;
    INSERT INTO identity.auditoria_perfil(usuario_id,accion,antes,despues)
        VALUES(p_id,'preferencias',COALESCE(v_antes,'{}'::jsonb),v_despues);
END $$ LANGUAGE plpgsql;
CREATE TABLE geo.sesiones_seguimiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tecnico_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    orden_id BIGINT NOT NULL REFERENCES orders.ordenes_servicio(id),
    version_sesion BIGINT NOT NULL,
    plataforma TEXT NOT NULL CHECK(plataforma IN ('web','android','ios')),
    segundo_plano BOOLEAN NOT NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expira_en TIMESTAMPTZ NOT NULL,
    cerrada_en TIMESTAMPTZ,
    CHECK(plataforma<>'web' OR NOT segundo_plano)
);
CREATE UNIQUE INDEX uq_sesion_gps_activa ON geo.sesiones_seguimiento(tecnico_id) WHERE cerrada_en IS NULL;
CREATE INDEX idx_sesiones_gps_orden ON geo.sesiones_seguimiento(orden_id);
ALTER TABLE geo.ubicacion_actual ADD COLUMN capturado_en TIMESTAMPTZ;
UPDATE geo.ubicacion_actual SET capturado_en=actualizado_en;
ALTER TABLE geo.ubicacion_actual ALTER COLUMN capturado_en SET DEFAULT clock_timestamp();
ALTER TABLE geo.ubicacion_actual ALTER COLUMN capturado_en SET NOT NULL;

CREATE FUNCTION identity.tecnico_operativo() RETURNS BIGINT AS $$
DECLARE v_id BIGINT:=orders.usuario_actual();
BEGIN
    PERFORM 1 FROM identity.usuarios WHERE id=v_id AND activo AND eliminado_en IS NULL
        AND rol='tecnico' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El técnico no está habilitado.' USING ERRCODE='42501'; END IF;
    -- Un único lock de perfil serializa operaciones del mismo técnico.
    PERFORM 1 FROM identity.perfiles_tecnico WHERE usuario_id=v_id
        AND estado_validacion='aprobado' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El técnico no está aprobado.' USING ERRCODE='42501'; END IF;
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.iniciar_sesion_gps(p_orden BIGINT,p_plataforma TEXT,p_segundo BOOLEAN,
    p_version BIGINT,p_expira TIMESTAMPTZ) RETURNS UUID AS $$
DECLARE v_tecnico BIGINT:=identity.tecnico_operativo(); v_id UUID;
BEGIN
    IF p_plataforma IS NULL OR p_plataforma NOT IN ('web','android','ios')
        OR p_segundo IS NULL OR (p_plataforma='web' AND p_segundo) THEN
        RAISE EXCEPTION 'Selecciona un modo de ubicación válido.';
    END IF;
    PERFORM 1 FROM identity.usuarios WHERE id=v_tecnico AND version_sesion=p_version;
    IF NOT FOUND OR p_expira IS NULL OR p_expira<=clock_timestamp() THEN
        RAISE EXCEPTION 'La sesión venció.' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM orders.ordenes_servicio WHERE id=p_orden AND tecnico_id=v_tecnico
        AND estado='en_camino' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La orden no admite seguimiento.' USING ERRCODE='P0424'; END IF;
    UPDATE geo.sesiones_seguimiento SET cerrada_en=clock_timestamp()
        WHERE tecnico_id=v_tecnico AND cerrada_en IS NULL;
    DELETE FROM geo.ubicacion_actual WHERE tecnico_id=v_tecnico AND orden_id IS NOT NULL;
    INSERT INTO geo.sesiones_seguimiento(tecnico_id,orden_id,version_sesion,plataforma,segundo_plano,expira_en)
        VALUES(v_tecnico,p_orden,p_version,p_plataforma,p_segundo,p_expira) RETURNING id INTO v_id;
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.detener_sesion_gps(p_sesion UUID) RETURNS VOID AS $$
DECLARE v_tecnico BIGINT:=orders.usuario_actual(); v_orden BIGINT;
BEGIN
    -- Se puede detener incluso si la aprobación cambió durante el trayecto.
    SELECT orden_id INTO v_orden FROM geo.sesiones_seguimiento
        WHERE id=p_sesion AND tecnico_id=v_tecnico;
    IF NOT FOUND THEN RETURN; END IF;
    PERFORM 1 FROM orders.ordenes_servicio WHERE id=v_orden FOR UPDATE;
    UPDATE geo.sesiones_seguimiento SET cerrada_en=COALESCE(cerrada_en,clock_timestamp())
        WHERE id=p_sesion AND tecnico_id=v_tecnico;
    -- Una petición antigua no debe borrar la ubicación de una sesión nueva.
    IF NOT EXISTS(SELECT 1 FROM geo.sesiones_seguimiento WHERE tecnico_id=v_tecnico
        AND cerrada_en IS NULL AND expira_en>clock_timestamp()) THEN
        DELETE FROM geo.ubicacion_actual WHERE tecnico_id=v_tecnico AND orden_id=v_orden;
    END IF;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.reportar_posicion_sesion(p_sesion UUID,p_lat DOUBLE PRECISION,p_lng DOUBLE PRECISION,
    p_precision REAL,p_capturado TIMESTAMPTZ) RETURNS BOOLEAN AS $$
DECLARE v_tecnico BIGINT:=identity.tecnico_operativo(); v_s geo.sesiones_seguimiento%ROWTYPE;
    v_orden BIGINT; v_ultima TIMESTAMPTZ; v_recepcion TIMESTAMPTZ:=clock_timestamp();
BEGIN
    SELECT orden_id INTO v_orden FROM geo.sesiones_seguimiento
        WHERE id=p_sesion AND tecnico_id=v_tecnico;
    IF NOT FOUND THEN RAISE EXCEPTION 'El seguimiento no está disponible.' USING ERRCODE='P0424'; END IF;
    PERFORM 1 FROM orders.ordenes_servicio WHERE id=v_orden AND tecnico_id=v_tecnico
        AND estado='en_camino' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La orden no admite seguimiento.' USING ERRCODE='P0424'; END IF;
    SELECT * INTO v_s FROM geo.sesiones_seguimiento WHERE id=p_sesion FOR UPDATE;
    v_recepcion:=clock_timestamp();
    IF v_s.cerrada_en IS NOT NULL OR v_s.expira_en<=v_recepcion OR NOT EXISTS(
        SELECT 1 FROM identity.usuarios WHERE id=v_tecnico AND version_sesion=v_s.version_sesion) THEN
        RAISE EXCEPTION 'La sesión de seguimiento venció.' USING ERRCODE='P0424';
    END IF;
    IF p_lat IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng IS NULL OR p_lng NOT BETWEEN -180 AND 180
        OR p_precision IS NULL OR p_precision NOT BETWEEN 0 AND 200
        OR p_capturado IS NULL OR p_capturado<v_recepcion-interval '30 seconds'
        OR p_capturado>v_recepcion+interval '5 seconds' THEN
        RAISE EXCEPTION 'La ubicación debe ser reciente y tener una precisión de hasta 200 metros.';
    END IF;
    SELECT capturado_en INTO v_ultima FROM geo.ubicacion_actual WHERE tecnico_id=v_tecnico;
    IF v_ultima IS NOT NULL AND (p_capturado<=v_ultima OR
        EXISTS(SELECT 1 FROM geo.ubicacion_actual WHERE tecnico_id=v_tecnico
            AND actualizado_en>v_recepcion-interval '3 seconds')) THEN RETURN FALSE; END IF;
    PERFORM pg_advisory_xact_lock(841913);
    PERFORM geo.crear_particion_ubicaciones(CURRENT_DATE);
    -- Reutilizar la escritura y validación de V19, sin duplicar la máquina de estados.
    PERFORM geo.reportar_ubicacion_tecnico(v_tecnico,v_orden,p_lat,p_lng,p_precision);
    UPDATE geo.ubicacion_actual SET capturado_en=p_capturado,actualizado_en=v_recepcion
        WHERE tecnico_id=v_tecnico AND orden_id=v_orden;
    RETURN TRUE;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.cerrar_gps_al_cambiar_orden() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado<>'en_camino' THEN
        UPDATE geo.sesiones_seguimiento SET cerrada_en=COALESCE(cerrada_en,clock_timestamp())
            WHERE orden_id=NEW.id AND cerrada_en IS NULL;
        DELETE FROM geo.ubicacion_actual WHERE orden_id=NEW.id;
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_cerrar_gps_orden AFTER UPDATE OF estado ON orders.ordenes_servicio
    FOR EACH ROW WHEN(NEW.estado IS DISTINCT FROM OLD.estado)
    EXECUTE FUNCTION geo.cerrar_gps_al_cambiar_orden();

-- Cliente hogar: foto de perfil, libreta de direcciones, preferencias y
-- reputación del cliente. No modifica migraciones ya aplicadas.

-- 1. La foto de perfil no participa de la edición con revisión ---------------
-- Subir o quitar la foto no debe invalidar un formulario abierto ni provocar
-- un 409 falso en una edición concurrente de nombre o teléfono.
CREATE OR REPLACE FUNCTION identity.incrementar_revision_admin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_cambio BOOLEAN;
BEGIN
    v_cambio := (to_jsonb(NEW) - 'foto_perfil_url' - 'actualizado_en' - 'revision_admin')
             IS DISTINCT FROM
                (to_jsonb(OLD) - 'foto_perfil_url' - 'actualizado_en' - 'revision_admin');
    NEW.revision_admin := CASE WHEN v_cambio THEN OLD.revision_admin + 1
                               ELSE OLD.revision_admin END;
    RETURN NEW;
END $$;

-- 2. Auditoría de perfil: acciones nuevas ------------------------------------
ALTER TABLE identity.auditoria_perfil DROP CONSTRAINT auditoria_perfil_accion_check;
ALTER TABLE identity.auditoria_perfil ADD CONSTRAINT auditoria_perfil_accion_check
    CHECK (accion IN ('editar','password','foto','direccion','preferencias'));

-- 3. Foto de perfil ----------------------------------------------------------
-- Devuelve la URL anterior para que el servicio borre el archivo solo después
-- del commit. La URL es un opaco de servidor: nunca se guarda una ruta elegida
-- por el cliente.
CREATE FUNCTION identity.cambiar_foto_perfil(p_id BIGINT, p_url TEXT)
RETURNS TEXT AS $$
DECLARE v_anterior TEXT;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Solo puedes cambiar tu propia foto.' USING ERRCODE='42501';
    END IF;
    SELECT foto_perfil_url INTO v_anterior FROM identity.usuarios
        WHERE id=p_id AND activo AND eliminado_en IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501';
    END IF;
    IF p_url IS NOT NULL AND p_url !~ '^/perfiles/[a-f0-9-]{36}\.(png|jpg|jpeg)$' THEN
        RAISE EXCEPTION 'La foto no es válida.';
    END IF;
    UPDATE identity.usuarios SET foto_perfil_url=p_url WHERE id=p_id;
    INSERT INTO identity.auditoria_perfil(usuario_id,accion,antes,despues)
        VALUES(p_id,'foto',jsonb_build_object('foto',v_anterior),
               jsonb_build_object('foto',p_url));
    RETURN v_anterior;
END $$ LANGUAGE plpgsql;

-- 4. Libreta de direcciones --------------------------------------------------
CREATE TABLE identity.direcciones_cliente (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    etiqueta TEXT NOT NULL,
    referencia TEXT NOT NULL,
    punto geography(Point,4326) NOT NULL,
    predeterminada BOOLEAN NOT NULL DEFAULT FALSE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT direcciones_etiqueta_check CHECK (length(btrim(etiqueta)) BETWEEN 1 AND 40),
    CONSTRAINT direcciones_referencia_check CHECK (length(btrim(referencia)) BETWEEN 5 AND 300)
);
-- Una sola predeterminada por cliente, y solo entre las activas.
CREATE UNIQUE INDEX ux_direccion_predeterminada ON identity.direcciones_cliente(usuario_id)
    WHERE predeterminada AND activa;
CREATE INDEX idx_direcciones_cliente ON identity.direcciones_cliente(usuario_id, activa, id);

CREATE FUNCTION identity.direccion_json(p_id BIGINT) RETURNS JSONB AS $$
    SELECT jsonb_build_object(
        'id', d.id, 'etiqueta', d.etiqueta, 'referencia', d.referencia,
        'latitud', ST_Y(d.punto::geometry), 'longitud', ST_X(d.punto::geometry),
        'predeterminada', d.predeterminada, 'activa', d.activa)
    FROM identity.direcciones_cliente d WHERE d.id=p_id;
$$ LANGUAGE sql STABLE;

-- Alta y edición comparten función: el cliente nunca elige el dueño.
CREATE FUNCTION identity.guardar_direccion(p_id BIGINT, p_direccion_id BIGINT,
    p_etiqueta TEXT, p_referencia TEXT, p_latitud DOUBLE PRECISION,
    p_longitud DOUBLE PRECISION, p_predeterminada BOOLEAN)
RETURNS BIGINT AS $$
DECLARE v_id BIGINT; v_antes JSONB; v_activas INT;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Solo puedes editar tus propias direcciones.' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM identity.usuarios
        WHERE id=p_id AND activo AND eliminado_en IS NULL AND rol='cliente';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501';
    END IF;
    IF p_etiqueta IS NULL OR length(btrim(p_etiqueta)) NOT BETWEEN 1 AND 40 THEN
        RAISE EXCEPTION 'La etiqueta debe tener entre 1 y 40 caracteres.';
    END IF;
    IF p_referencia IS NULL OR length(btrim(p_referencia)) NOT BETWEEN 5 AND 300 THEN
        RAISE EXCEPTION 'La dirección debe tener entre 5 y 300 caracteres.';
    END IF;
    IF p_latitud IS NULL OR p_latitud NOT BETWEEN -90 AND 90
        OR p_longitud IS NULL OR p_longitud NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'Las coordenadas no son válidas.';
    END IF;
    IF p_direccion_id IS NULL THEN
        SELECT count(*) INTO v_activas FROM identity.direcciones_cliente
            WHERE usuario_id=p_id AND activa;
        IF v_activas >= 10 THEN
            RAISE EXCEPTION 'Solo puedes guardar hasta 10 direcciones.' USING ERRCODE='P0422';
        END IF;
        -- La primera dirección siempre es la predeterminada.
        IF v_activas = 0 THEN p_predeterminada := TRUE; END IF;
        IF p_predeterminada THEN
            UPDATE identity.direcciones_cliente SET predeterminada=FALSE
                WHERE usuario_id=p_id AND predeterminada;
        END IF;
        INSERT INTO identity.direcciones_cliente(usuario_id,etiqueta,referencia,punto,predeterminada)
            VALUES(p_id,btrim(p_etiqueta),btrim(p_referencia),
                   ST_SetSRID(ST_MakePoint(p_longitud,p_latitud),4326)::geography,
                   COALESCE(p_predeterminada,FALSE))
            RETURNING id INTO v_id;
    ELSE
        SELECT identity.direccion_json(p_direccion_id) INTO v_antes
            FROM identity.direcciones_cliente d
            WHERE d.id=p_direccion_id AND d.usuario_id=p_id AND d.activa FOR UPDATE;
        IF v_antes IS NULL THEN
            RAISE EXCEPTION 'La dirección no está disponible.' USING ERRCODE='P0425';
        END IF;
        IF p_predeterminada THEN
            UPDATE identity.direcciones_cliente SET predeterminada=FALSE
                WHERE usuario_id=p_id AND predeterminada AND id<>p_direccion_id;
        END IF;
        UPDATE identity.direcciones_cliente SET
            etiqueta=btrim(p_etiqueta), referencia=btrim(p_referencia),
            punto=ST_SetSRID(ST_MakePoint(p_longitud,p_latitud),4326)::geography,
            predeterminada=COALESCE(p_predeterminada,FALSE), actualizado_en=now()
            WHERE id=p_direccion_id;
        v_id := p_direccion_id;
    END IF;
    INSERT INTO identity.auditoria_perfil(usuario_id,accion,antes,despues)
        VALUES(p_id,'direccion',COALESCE(v_antes,'{}'::jsonb),
               identity.direccion_json(v_id));
    RETURN v_id;
END $$ LANGUAGE plpgsql;

-- Baja lógica: una orden pasada conserva su copia de la dirección.
CREATE FUNCTION identity.eliminar_direccion(p_id BIGINT, p_direccion_id BIGINT)
RETURNS VOID AS $$
DECLARE v_antes JSONB;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Solo puedes quitar tus propias direcciones.' USING ERRCODE='42501';
    END IF;
    SELECT identity.direccion_json(p_direccion_id) INTO v_antes
        FROM identity.direcciones_cliente d
        WHERE d.id=p_direccion_id AND d.usuario_id=p_id AND d.activa FOR UPDATE;
    IF v_antes IS NULL THEN
        RAISE EXCEPTION 'La dirección no está disponible.' USING ERRCODE='P0425';
    END IF;
    UPDATE identity.direcciones_cliente
        SET activa=FALSE, predeterminada=FALSE, actualizado_en=now()
        WHERE id=p_direccion_id;
    INSERT INTO identity.auditoria_perfil(usuario_id,accion,antes,despues)
        VALUES(p_id,'direccion',v_antes,'{"activa":false}'::jsonb);
END $$ LANGUAGE plpgsql;

-- 5. Preferencias ------------------------------------------------------------
CREATE TABLE identity.preferencias_cliente (
    usuario_id BIGINT PRIMARY KEY REFERENCES identity.usuarios(id),
    notificaciones_email BOOLEAN NOT NULL DEFAULT TRUE,
    notificaciones_push BOOLEAN NOT NULL DEFAULT FALSE,
    compartir_ubicacion BOOLEAN NOT NULL DEFAULT TRUE,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION identity.guardar_preferencias(p_id BIGINT, p_email BOOLEAN,
    p_push BOOLEAN, p_ubicacion BOOLEAN)
RETURNS VOID AS $$
DECLARE v_antes JSONB; v_despues JSONB;
BEGIN
    IF orders.usuario_actual() IS DISTINCT FROM p_id THEN
        RAISE EXCEPTION 'Solo puedes cambiar tus propias preferencias.' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM identity.usuarios
        WHERE id=p_id AND activo AND eliminado_en IS NULL AND rol='cliente';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta no está disponible.' USING ERRCODE='42501';
    END IF;
    SELECT to_jsonb(p) INTO v_antes FROM identity.preferencias_cliente p WHERE usuario_id=p_id;
    INSERT INTO identity.preferencias_cliente(usuario_id,notificaciones_email,
        notificaciones_push,compartir_ubicacion)
        VALUES(p_id,COALESCE(p_email,TRUE),COALESCE(p_push,FALSE),COALESCE(p_ubicacion,TRUE))
        ON CONFLICT (usuario_id) DO UPDATE SET
            notificaciones_email=EXCLUDED.notificaciones_email,
            notificaciones_push=EXCLUDED.notificaciones_push,
            compartir_ubicacion=EXCLUDED.compartir_ubicacion,
            actualizado_en=now();
    SELECT to_jsonb(p) INTO v_despues FROM identity.preferencias_cliente p WHERE usuario_id=p_id;
    INSERT INTO identity.auditoria_perfil(usuario_id,accion,antes,despues)
        VALUES(p_id,'preferencias',COALESCE(v_antes,'{}'::jsonb),v_despues);
END $$ LANGUAGE plpgsql;

-- 6. Reputación del cliente --------------------------------------------------
-- El cliente no tenía índice: recalcular_indice solo cubre técnicos.
CREATE TABLE reputation.indices_cliente (
    cliente_id BIGINT PRIMARY KEY REFERENCES identity.usuarios(id),
    calificacion_promedio NUMERIC(3,2) NOT NULL DEFAULT 0,
    total_calificaciones INT NOT NULL DEFAULT 0,
    formula_version SMALLINT NOT NULL DEFAULT 1,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION reputation.recalcular_cliente(p_cliente_id BIGINT) RETURNS VOID AS $$
DECLARE v_prom NUMERIC(3,2); v_total INT;
BEGIN
    SELECT COALESCE(round(avg(puntaje),2),0), count(*) INTO v_prom,v_total
        FROM reputation.calificaciones WHERE calificado_id=p_cliente_id;
    INSERT INTO reputation.indices_cliente(cliente_id,calificacion_promedio,total_calificaciones)
        VALUES(p_cliente_id,v_prom,v_total)
        ON CONFLICT (cliente_id) DO UPDATE SET
            calificacion_promedio=EXCLUDED.calificacion_promedio,
            total_calificaciones=EXCLUDED.total_calificaciones,
            actualizado_en=now();
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reputation.fn_calificacion_recalcular()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity.usuarios
               WHERE id = NEW.calificado_id AND rol = 'tecnico') THEN
        PERFORM reputation.recalcular_indice(NEW.calificado_id);
    ELSE
        PERFORM reputation.recalcular_cliente(NEW.calificado_id);
    END IF;
    RETURN NULL;
END $$;

-- Comentarios: nacen ocultos hasta que exista moderación administrativa.
ALTER TABLE reputation.calificaciones ADD COLUMN visible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reputation.calificaciones ADD COLUMN moderado_en TIMESTAMPTZ;
ALTER TABLE reputation.calificaciones ADD COLUMN moderado_por BIGINT REFERENCES identity.usuarios(id);
CREATE INDEX idx_calif_calificado_fecha
    ON reputation.calificaciones(calificado_id, registrado_en DESC, id DESC);

-- Una calificación por orden y calificador; el destinatario es siempre la
-- contraparte de la orden, nunca un identificador enviado por el cliente.
CREATE FUNCTION reputation.calificar(p_orden_id BIGINT, p_puntaje SMALLINT, p_comentario TEXT)
RETURNS BIGINT AS $$
DECLARE v_orden orders.ordenes_servicio%ROWTYPE;
        v_actor BIGINT := orders.usuario_actual();
        v_calificado BIGINT; v_id BIGINT;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Necesitas iniciar sesión.' USING ERRCODE='42501';
    END IF;
    SELECT * INTO v_orden FROM orders.ordenes_servicio WHERE id=p_orden_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La orden no está disponible.' USING ERRCODE='P0404';
    END IF;
    IF v_actor = v_orden.cliente_id THEN
        v_calificado := v_orden.tecnico_id;
    ELSIF v_actor = v_orden.tecnico_id THEN
        v_calificado := v_orden.cliente_id;
    ELSE
        RAISE EXCEPTION 'Solo el cliente y el técnico de la orden pueden calificar.'
            USING ERRCODE='42501';
    END IF;
    IF v_calificado IS NULL THEN
        RAISE EXCEPTION 'La orden todavía no tiene un técnico asignado.' USING ERRCODE='P0423';
    END IF;
    IF v_orden.estado <> 'finalizado' THEN
        RAISE EXCEPTION 'Solo puedes calificar una orden finalizada.' USING ERRCODE='P0423';
    END IF;
    IF p_puntaje IS NULL OR p_puntaje NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'Selecciona una puntuación de 1 a 5.';
    END IF;
    IF p_comentario IS NOT NULL AND length(btrim(p_comentario)) > 1000 THEN
        RAISE EXCEPTION 'El comentario no puede superar los 1000 caracteres.';
    END IF;
    INSERT INTO reputation.calificaciones(orden_id,calificador_id,calificado_id,puntaje,comentario)
        VALUES(p_orden_id,v_actor,v_calificado,p_puntaje,NULLIF(btrim(p_comentario),''))
        RETURNING id INTO v_id;
    RETURN v_id;
END $$ LANGUAGE plpgsql;

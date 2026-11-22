-- Las áreas vigentes no se sustituyen desde un CRUD del perfil aprobado.
ALTER TABLE geo.zonas_cobertura ADD COLUMN centro geography(Point,4326);
ALTER TABLE geo.zonas_cobertura ADD COLUMN radio_metros INTEGER;
ALTER TABLE geo.zonas_cobertura ADD CONSTRAINT ck_zona_circular CHECK(
    (centro IS NULL AND radio_metros IS NULL) OR
    (centro IS NOT NULL AND radio_metros IS NOT NULL AND radio_metros BETWEEN 100 AND 50000));

CREATE TABLE geo.control_cobertura (
    tecnico_id BIGINT PRIMARY KEY REFERENCES identity.usuarios(id),
    revision BIGINT NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE TABLE geo.solicitudes_cobertura (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tecnico_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    clave UUID NOT NULL,
    huella TEXT NOT NULL,
    revision_base BIGINT NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobada','rechazada','retirada')),
    motivo TEXT NOT NULL CHECK(length(btrim(motivo)) BETWEEN 5 AND 500),
    zonas JSONB NOT NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    revisada_en TIMESTAMPTZ,
    revisada_por BIGINT REFERENCES identity.usuarios(id),
    motivo_revision TEXT,
    UNIQUE(tecnico_id,clave),
    CHECK(jsonb_typeof(zonas)='array' AND jsonb_array_length(zonas) BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX uq_cobertura_pendiente ON geo.solicitudes_cobertura(tecnico_id) WHERE estado='pendiente';
CREATE INDEX idx_cobertura_solicitudes_estado ON geo.solicitudes_cobertura(estado,id DESC);
CREATE TABLE geo.auditoria_cobertura (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    solicitud_id BIGINT NOT NULL REFERENCES geo.solicitudes_cobertura(id),
    actor_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    accion TEXT NOT NULL CHECK(accion IN ('solicitar','aprobar','rechazar','retirar')),
    antes JSONB NOT NULL,
    despues JSONB NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION geo.cobertura_json(p_tecnico BIGINT) RETURNS JSONB AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre_zona,
        'geometria',ST_AsGeoJSON(poligono::geometry)::jsonb,
        'latitud',CASE WHEN centro IS NOT NULL THEN ST_Y(centro::geometry) END,
        'longitud',CASE WHEN centro IS NOT NULL THEN ST_X(centro::geometry) END,
        'radioMetros',radio_metros) ORDER BY id),'[]'::jsonb)
    FROM geo.zonas_cobertura WHERE tecnico_id=p_tecnico AND activo;
$$ LANGUAGE sql STABLE;

CREATE FUNCTION geo.solicitar_cobertura(p_clave UUID,p_revision BIGINT,p_motivo TEXT,p_zonas JSONB)
RETURNS BIGINT AS $$
DECLARE v_tecnico BIGINT:=identity.tecnico_operativo(); v_revision BIGINT; v_huella TEXT;
    v_previa geo.solicitudes_cobertura%ROWTYPE; v_z JSONB; v_lat NUMERIC; v_lng NUMERIC; v_radio NUMERIC; v_id BIGINT;
BEGIN
    IF p_clave IS NULL THEN RAISE EXCEPTION 'La clave de solicitud no es válida.'; END IF;
    v_huella:=encode(digest(COALESCE(p_revision::text,'')||COALESCE(p_motivo,'')||COALESCE(p_zonas::text,''),'sha256'),'hex');
    SELECT * INTO v_previa FROM geo.solicitudes_cobertura WHERE tecnico_id=v_tecnico AND clave=p_clave;
    IF FOUND THEN
        IF v_previa.huella<>v_huella THEN RAISE EXCEPTION 'Esta clave ya corresponde a otra propuesta.' USING ERRCODE='P0409'; END IF;
        RETURN v_previa.id;
    END IF;
    INSERT INTO geo.control_cobertura(tecnico_id) VALUES(v_tecnico) ON CONFLICT DO NOTHING;
    SELECT revision INTO v_revision FROM geo.control_cobertura WHERE tecnico_id=v_tecnico FOR UPDATE;
    IF p_revision IS NULL OR p_revision<>v_revision THEN
        RAISE EXCEPTION 'Tu cobertura cambió. Actualiza antes de enviar.' USING ERRCODE='P0409';
    END IF;
    IF EXISTS(SELECT 1 FROM geo.solicitudes_cobertura WHERE tecnico_id=v_tecnico AND estado='pendiente') THEN
        RAISE EXCEPTION 'Ya tienes una propuesta pendiente de revisión.' USING ERRCODE='P0409';
    END IF;
    IF (SELECT count(*) FROM geo.solicitudes_cobertura WHERE tecnico_id=v_tecnico
        AND creada_en>clock_timestamp()-interval '24 hours')>=20 THEN
        RAISE EXCEPTION 'Alcanzaste el límite diario de propuestas. Intenta mañana.' USING ERRCODE='P0409';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM identity.perfiles_tecnico WHERE usuario_id=v_tecnico AND disponibilidad='fuera_servicio')
        OR EXISTS(SELECT 1 FROM orders.ordenes_servicio WHERE tecnico_id=v_tecnico AND estado NOT IN ('finalizado','cancelado')) THEN
        RAISE EXCEPTION 'Ponte fuera de servicio y termina tus órdenes antes de proponer otra cobertura.' USING ERRCODE='P0409';
    END IF;
    IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 500 THEN
        RAISE EXCEPTION 'Describe el motivo en entre 5 y 500 caracteres.';
    END IF;
    IF p_zonas IS NULL OR jsonb_typeof(p_zonas)<>'array' THEN RAISE EXCEPTION 'Agrega entre una y cinco zonas.'; END IF;
    IF jsonb_array_length(p_zonas) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Agrega entre una y cinco zonas.'; END IF;
    FOR v_z IN SELECT value FROM jsonb_array_elements(p_zonas) LOOP
        IF v_z->>'nombre' IS NULL OR length(btrim(v_z->>'nombre')) NOT BETWEEN 2 AND 100
            OR jsonb_typeof(v_z->'latitud') IS DISTINCT FROM 'number'
            OR jsonb_typeof(v_z->'longitud') IS DISTINCT FROM 'number'
            OR jsonb_typeof(v_z->'radioMetros') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Completa el nombre, el punto y el radio de cada zona.';
        END IF;
        v_lat:=(v_z->>'latitud')::numeric; v_lng:=(v_z->>'longitud')::numeric; v_radio:=(v_z->>'radioMetros')::numeric;
        IF v_lat NOT BETWEEN -85 AND 85 OR v_lng NOT BETWEEN -180 AND 180
            OR v_radio NOT BETWEEN 100 AND 50000 OR trunc(v_radio)<>v_radio THEN
            RAISE EXCEPTION 'Revisa las coordenadas y un radio entero de entre 100 y 50000 metros.';
        END IF;
    END LOOP;
    INSERT INTO geo.solicitudes_cobertura(tecnico_id,clave,huella,revision_base,motivo,zonas)
        VALUES(v_tecnico,p_clave,v_huella,v_revision,btrim(p_motivo),p_zonas) RETURNING id INTO v_id;
    INSERT INTO geo.auditoria_cobertura(solicitud_id,actor_id,accion,antes,despues)
        VALUES(v_id,v_tecnico,'solicitar',geo.cobertura_json(v_tecnico),p_zonas);
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.retirar_solicitud_cobertura(p_id BIGINT) RETURNS VOID AS $$
DECLARE v_tecnico BIGINT:=identity.tecnico_operativo(); v_s geo.solicitudes_cobertura%ROWTYPE;
BEGIN
    SELECT * INTO v_s FROM geo.solicitudes_cobertura WHERE id=p_id AND tecnico_id=v_tecnico FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La propuesta no está disponible.' USING ERRCODE='P0425'; END IF;
    IF v_s.estado='retirada' THEN RETURN; END IF;
    IF v_s.estado<>'pendiente' THEN RAISE EXCEPTION 'La propuesta ya fue revisada.' USING ERRCODE='P0409'; END IF;
    UPDATE geo.solicitudes_cobertura SET estado='retirada',revision=revision+1,revisada_en=clock_timestamp()
        WHERE id=p_id;
    INSERT INTO geo.auditoria_cobertura(solicitud_id,actor_id,accion,antes,despues)
        VALUES(p_id,v_tecnico,'retirar',jsonb_build_object('estado',v_s.estado),jsonb_build_object('estado','retirada'));
END $$ LANGUAGE plpgsql;

CREATE FUNCTION geo.revisar_solicitud_cobertura(p_id BIGINT,p_revision BIGINT,p_aprobar BOOLEAN,p_motivo TEXT)
RETURNS VOID AS $$
DECLARE v_actor BIGINT:=orders.usuario_actual(); v_tecnico BIGINT; v_s geo.solicitudes_cobertura%ROWTYPE;
    v_actual BIGINT; v_antes JSONB; v_z JSONB; v_centro geography(Point,4326);
BEGIN
    PERFORM 1 FROM identity.usuarios WHERE id=v_actor AND rol='administrador' AND activo AND eliminado_en IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No tienes permiso para revisar la cobertura.' USING ERRCODE='42501'; END IF;
    SELECT tecnico_id INTO v_tecnico FROM geo.solicitudes_cobertura WHERE id=p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'La propuesta no está disponible.' USING ERRCODE='P0425'; END IF;
    -- Mismo orden de locks que solicitud, disponibilidad y aceptación.
    PERFORM 1 FROM identity.usuarios WHERE id=v_tecnico FOR SHARE;
    PERFORM 1 FROM identity.perfiles_tecnico WHERE usuario_id=v_tecnico FOR UPDATE;
    SELECT revision INTO v_actual FROM geo.control_cobertura WHERE tecnico_id=v_tecnico FOR UPDATE;
    SELECT * INTO v_s FROM geo.solicitudes_cobertura WHERE id=p_id FOR UPDATE;
    IF p_revision IS NULL OR p_revision<>v_s.revision OR v_s.estado<>'pendiente' THEN
        RAISE EXCEPTION 'La propuesta cambió o ya fue procesada. Actualiza la ficha.' USING ERRCODE='P0409';
    END IF;
    IF p_aprobar IS NULL OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 5 AND 500 THEN
        RAISE EXCEPTION 'Confirma tu decisión y un motivo de entre 5 y 500 caracteres.';
    END IF;
    v_antes:=geo.cobertura_json(v_tecnico);
    IF p_aprobar THEN
        IF v_actual IS DISTINCT FROM v_s.revision_base THEN
            RAISE EXCEPTION 'La cobertura vigente cambió después de la propuesta.' USING ERRCODE='P0409';
        END IF;
        IF NOT EXISTS(SELECT 1 FROM identity.usuarios u JOIN identity.perfiles_tecnico p ON p.usuario_id=u.id
            WHERE u.id=v_tecnico AND u.activo AND u.eliminado_en IS NULL AND p.estado_validacion='aprobado'
                AND p.disponibilidad='fuera_servicio')
            OR EXISTS(SELECT 1 FROM orders.ordenes_servicio WHERE tecnico_id=v_tecnico AND estado NOT IN ('finalizado','cancelado')) THEN
            RAISE EXCEPTION 'Para aprobar, el técnico debe estar activo, aprobado, fuera de servicio y sin órdenes abiertas.' USING ERRCODE='P0409';
        END IF;
        UPDATE geo.zonas_cobertura SET activo=false WHERE tecnico_id=v_tecnico AND activo;
        FOR v_z IN SELECT value FROM jsonb_array_elements(v_s.zonas) LOOP
            v_centro:=ST_SetSRID(ST_MakePoint((v_z->>'longitud')::double precision,(v_z->>'latitud')::double precision),4326)::geography;
            INSERT INTO geo.zonas_cobertura(tecnico_id,nombre_zona,poligono,centro,radio_metros)
                VALUES(v_tecnico,btrim(v_z->>'nombre'),ST_Buffer(v_centro,(v_z->>'radioMetros')::int),
                    v_centro,(v_z->>'radioMetros')::int);
        END LOOP;
        UPDATE geo.control_cobertura SET revision=revision+1 WHERE tecnico_id=v_tecnico;
    END IF;
    UPDATE geo.solicitudes_cobertura SET estado=CASE WHEN p_aprobar THEN 'aprobada' ELSE 'rechazada' END,
        revision=revision+1,revisada_en=clock_timestamp(),revisada_por=v_actor,motivo_revision=btrim(p_motivo) WHERE id=p_id;
    INSERT INTO geo.auditoria_cobertura(solicitud_id,actor_id,accion,antes,despues)
        VALUES(p_id,v_actor,CASE WHEN p_aprobar THEN 'aprobar' ELSE 'rechazar' END,v_antes,
            jsonb_build_object('cobertura',geo.cobertura_json(v_tecnico),'motivo',btrim(p_motivo)));
    INSERT INTO notification.notificaciones(usuario_id,tipo,mensaje)
        VALUES(v_tecnico,'sistema',CASE WHEN p_aprobar THEN 'Tu nueva cobertura fue aprobada.' ELSE 'Tu propuesta de cobertura fue rechazada. Revisa el motivo en Mi cobertura.' END);
END $$ LANGUAGE plpgsql;

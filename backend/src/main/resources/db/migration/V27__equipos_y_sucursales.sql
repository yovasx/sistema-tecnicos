-- Una cuenta empresarial representa a su responsable autorizado; no hay multitenencia SaaS.
CREATE TABLE identity.sucursales_cliente (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    nombre TEXT NOT NULL CHECK (length(btrim(nombre)) BETWEEN 2 AND 100),
    referencia TEXT NOT NULL CHECK (length(btrim(referencia)) BETWEEN 5 AND 300),
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    revision BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE orders.equipos_cliente (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    sucursal_id BIGINT REFERENCES identity.sucursales_cliente(id),
    nombre TEXT NOT NULL CHECK (length(btrim(nombre)) BETWEEN 2 AND 100),
    marca TEXT CHECK (length(marca)<=100),
    modelo TEXT CHECK (length(modelo)<=100),
    identificador TEXT CHECK (length(identificador)<=100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    revision BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_equipos_cliente ON orders.equipos_cliente(cliente_id,id);
CREATE TABLE orders.equipos_orden (
    orden_id BIGINT PRIMARY KEY REFERENCES orders.ordenes_servicio(id),
    equipo_id BIGINT NOT NULL REFERENCES orders.equipos_cliente(id),
    nombre_snapshot TEXT NOT NULL,
    sucursal_snapshot TEXT
);
CREATE INDEX idx_equipos_historial ON orders.equipos_orden(equipo_id,orden_id);

CREATE FUNCTION orders.cliente_gestion_activo() RETURNS BIGINT AS $$
DECLARE v_id BIGINT:=orders.usuario_actual();
BEGIN
    PERFORM 1 FROM identity.usuarios WHERE id=v_id AND rol='cliente' AND activo AND eliminado_en IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no puede gestionar equipos.' USING ERRCODE='42501'; END IF;
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION identity.guardar_sucursal(p_id BIGINT,p_revision BIGINT,p_nombre TEXT,p_referencia TEXT,p_activa BOOLEAN)
RETURNS BIGINT AS $$
DECLARE v_cliente BIGINT:=orders.cliente_gestion_activo(); v_id BIGINT;
BEGIN
    IF NOT EXISTS(SELECT 1 FROM identity.usuarios WHERE id=v_cliente AND tipo_cliente='empresa') THEN
        RAISE EXCEPTION 'Las sucursales corresponden a cuentas empresariales.' USING ERRCODE='42501'; END IF;
    IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 100
        OR p_referencia IS NULL OR length(btrim(p_referencia)) NOT BETWEEN 5 AND 300 OR p_activa IS NULL THEN
        RAISE EXCEPTION 'Completa el nombre y la dirección de la sucursal.'; END IF;
    IF p_id IS NULL THEN
        IF (SELECT count(*) FROM identity.sucursales_cliente WHERE cliente_id=v_cliente)>=20 THEN
            RAISE EXCEPTION 'Puedes registrar hasta 20 sucursales.'; END IF;
        INSERT INTO identity.sucursales_cliente(cliente_id,nombre,referencia)
        VALUES(v_cliente,btrim(p_nombre),btrim(p_referencia)) RETURNING id INTO v_id;
    ELSE
        UPDATE identity.sucursales_cliente SET nombre=btrim(p_nombre),referencia=btrim(p_referencia),
            activa=p_activa,revision=revision+1 WHERE id=p_id AND cliente_id=v_cliente AND revision=p_revision RETURNING id INTO v_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'La sucursal cambió o no está disponible.' USING ERRCODE='P0409'; END IF;
    END IF;
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.guardar_equipo(p_id BIGINT,p_revision BIGINT,p_sucursal BIGINT,p_nombre TEXT,
    p_marca TEXT,p_modelo TEXT,p_identificador TEXT,p_activo BOOLEAN) RETURNS BIGINT AS $$
DECLARE v_cliente BIGINT:=orders.cliente_gestion_activo(); v_id BIGINT;
BEGIN
    IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 2 AND 100
        OR coalesce(length(p_marca),0)>100 OR coalesce(length(p_modelo),0)>100
        OR coalesce(length(p_identificador),0)>100 OR p_activo IS NULL THEN
        RAISE EXCEPTION 'Revisa los datos del equipo (hasta 100 caracteres por campo).'; END IF;
    IF p_sucursal IS NOT NULL AND NOT EXISTS(SELECT 1 FROM identity.sucursales_cliente
        WHERE id=p_sucursal AND cliente_id=v_cliente AND activa) THEN
        RAISE EXCEPTION 'La sucursal no está disponible.' USING ERRCODE='42501'; END IF;
    IF p_id IS NULL THEN
        IF (SELECT count(*) FROM orders.equipos_cliente WHERE cliente_id=v_cliente)>=100 THEN
            RAISE EXCEPTION 'Puedes registrar hasta 100 equipos.'; END IF;
        INSERT INTO orders.equipos_cliente(cliente_id,sucursal_id,nombre,marca,modelo,identificador)
        VALUES(v_cliente,p_sucursal,btrim(p_nombre),nullif(btrim(p_marca),''),nullif(btrim(p_modelo),''),nullif(btrim(p_identificador),''))
        RETURNING id INTO v_id;
    ELSE
        UPDATE orders.equipos_cliente SET sucursal_id=p_sucursal,nombre=btrim(p_nombre),marca=nullif(btrim(p_marca),''),
            modelo=nullif(btrim(p_modelo),''),identificador=nullif(btrim(p_identificador),''),
            activo=p_activo,revision=revision+1
        WHERE id=p_id AND cliente_id=v_cliente AND revision=p_revision RETURNING id INTO v_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'El equipo cambió o no está disponible.' USING ERRCODE='P0409'; END IF;
    END IF;
    RETURN v_id;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION orders.vincular_equipo(p_orden BIGINT,p_equipo BIGINT) RETURNS VOID AS $$
DECLARE v_o orders.ordenes_servicio; v_e orders.equipos_cliente; v_sucursal TEXT;
BEGIN
    SELECT * INTO v_o FROM orders.ordenes_servicio WHERE id=p_orden AND cliente_id=orders.usuario_actual() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La orden no está disponible.' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM orders.equipos_orden WHERE orden_id=p_orden AND equipo_id=p_equipo) THEN RETURN; END IF;
    IF v_o.estado<>'solicitado' OR EXISTS(SELECT 1 FROM orders.equipos_orden WHERE orden_id=p_orden) THEN
        RAISE EXCEPTION 'No puedes cambiar el equipo de una solicitud enviada.' USING ERRCODE='P0409'; END IF;
    SELECT * INTO v_e FROM orders.equipos_cliente WHERE id=p_equipo AND cliente_id=v_o.cliente_id AND activo FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El equipo no está disponible.' USING ERRCODE='42501'; END IF;
    SELECT nombre INTO v_sucursal FROM identity.sucursales_cliente WHERE id=v_e.sucursal_id AND activa;
    IF v_e.sucursal_id IS NOT NULL AND v_sucursal IS NULL THEN
        RAISE EXCEPTION 'La sucursal del equipo está archivada.' USING ERRCODE='P0409'; END IF;
    INSERT INTO orders.equipos_orden(orden_id,equipo_id,nombre_snapshot,sucursal_snapshot)
    VALUES(p_orden,p_equipo,v_e.nombre,v_sucursal);
END $$ LANGUAGE plpgsql;

CREATE TABLE orders.auditoria_equipos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    origen TEXT NOT NULL, sujeto_id BIGINT NOT NULL, actor_id BIGINT,
    antes JSONB, despues JSONB, creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION orders.auditar_equipo_sucursal() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO orders.auditoria_equipos(origen,sujeto_id,actor_id,antes,despues)
    VALUES(TG_TABLE_NAME,NEW.id,orders.usuario_actual(),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW));
    RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_auditoria_equipo AFTER INSERT OR UPDATE ON orders.equipos_cliente
FOR EACH ROW EXECUTE FUNCTION orders.auditar_equipo_sucursal();
CREATE TRIGGER tr_auditoria_sucursal AFTER INSERT OR UPDATE ON identity.sucursales_cliente
FOR EACH ROW EXECUTE FUNCTION orders.auditar_equipo_sucursal();

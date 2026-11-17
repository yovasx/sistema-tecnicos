-- =============================================================================
-- V5: expediente técnico (onboarding por niveles, estilo KYC de billeteras)
-- =============================================================================
-- El técnico se registra solo (nivel 0) y avanza por pasos:
--   nivel 0 = cuenta creada
--   nivel 1 = email verificado con OTP
--   nivel 2 = identidad validada (datos personales + CI y certificados subidos)
--   nivel 3 = habilitado para trabajar (aprobado; estado_validacion='aprobado')
--
-- Sin proveedor de identidad (OCR + prueba de vida), el tramo documental se
-- revisa por humanos (modo mixto): todo lo verificable por reglas se automatiza
-- y solo los documentos van a la cola de admin. La aprobación final sigue siendo
-- humana hasta que se contrate el proveedor; entonces se enchufa en el puerto
-- VerificadorIdentidad sin tocar el resto.

CREATE TYPE identity.estado_expediente AS ENUM (
    'borrador',
    'en_revision',
    'observado',
    'aprobado',
    'rechazado'
);

ALTER TABLE identity.perfiles_tecnico
    ADD COLUMN ci               VARCHAR(20),
    ADD COLUMN ci_frente_url    TEXT,
    ADD COLUMN ci_dorso_url     TEXT,
    ADD COLUMN selfie_url       TEXT,
    ADD COLUMN fecha_nacimiento DATE,
    ADD COLUMN email_verificado_en TIMESTAMPTZ,
    ADD COLUMN nivel            SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN estado_expediente identity.estado_expediente NOT NULL DEFAULT 'borrador',
    ADD COLUMN observaciones    JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN enviado_en       TIMESTAMPTZ,
    ADD CONSTRAINT ck_perfil_nivel CHECK (nivel BETWEEN 0 AND 3),
    -- Aprobar exige lo mínimo verificable: contacto, CI y documentos del CI.
    ADD CONSTRAINT ck_perfil_expediente_aprobado CHECK (
        estado_expediente <> 'aprobado'
        OR (
            email_verificado_en IS NOT NULL
            AND ci IS NOT NULL
            AND ci_frente_url IS NOT NULL
            AND ci_dorso_url IS NOT NULL
        )
    );

-- Códigos OTP: el plano nunca se guarda, solo SHA-256.
CREATE TABLE identity.codigos_verificacion (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id    BIGINT NOT NULL REFERENCES identity.usuarios(id),
    tipo          VARCHAR(10) NOT NULL DEFAULT 'email',
    codigo_hash   VARCHAR(64) NOT NULL,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en     TIMESTAMPTZ NOT NULL,
    intentos      INT NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    confirmado_en TIMESTAMPTZ
);
CREATE INDEX idx_codigos_usuario ON identity.codigos_verificacion(usuario_id, tipo, creado_en DESC);

-- =============================================================================
-- Reglas del expediente (todas con RAISE P0001 -> 422 REGLA_NEGOCIO)
-- =============================================================================

-- Pide un código de 6 dígitos por email. Devuelve el plano para que Java lo
-- envíe (en dev además se expone; ver ServicioEmail).
CREATE OR REPLACE FUNCTION identity.solicitar_codigo_email(p_usuario_id BIGINT)
RETURNS TEXT AS $$
DECLARE
    v_codigo TEXT;
    v_ultimo TIMESTAMPTZ;
BEGIN
    SELECT creado_en INTO v_ultimo
    FROM identity.codigos_verificacion
    WHERE usuario_id = p_usuario_id
      AND tipo = 'email'
      AND confirmado_en IS NULL
    ORDER BY creado_en DESC
    LIMIT 1;

    IF v_ultimo IS NOT NULL AND v_ultimo > now() - INTERVAL '60 seconds' THEN
        RAISE EXCEPTION 'Esperá 60 segundos para pedir un código nuevo.'
            USING ERRCODE = 'P0001';
    END IF;

    v_codigo := lpad(floor(random() * 1000000)::int::text, 6, '0');

    INSERT INTO identity.codigos_verificacion (usuario_id, tipo, codigo_hash, expira_en)
    VALUES (p_usuario_id, 'email',
            encode(digest(v_codigo, 'sha256'), 'hex'),
            now() + INTERVAL '10 minutes');

    RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;

-- Confirma el OTP: consume el código, marca el email verificado y sube a nivel 1.
CREATE OR REPLACE FUNCTION identity.confirmar_codigo_email(p_usuario_id BIGINT, p_codigo TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_fila RECORD;
BEGIN
    SELECT * INTO v_fila
    FROM identity.codigos_verificacion
    WHERE usuario_id = p_usuario_id
      AND tipo = 'email'
      AND confirmado_en IS NULL
    ORDER BY creado_en DESC
    LIMIT 1;

    IF v_fila IS NULL THEN
        RAISE EXCEPTION 'No hay un código pendiente. Pedí uno nuevo.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_fila.expira_en < now() THEN
        RAISE EXCEPTION 'El código expiró. Pedí uno nuevo.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_fila.intentos >= 5 THEN
        RAISE EXCEPTION 'Superaste los 5 intentos permitidos. Pedí un código nuevo.'
            USING ERRCODE = 'P0001';
    END IF;

    IF encode(digest(p_codigo, 'sha256'), 'hex') <> v_fila.codigo_hash THEN
        UPDATE identity.codigos_verificacion
           SET intentos = intentos + 1
         WHERE id = v_fila.id;
        RAISE EXCEPTION 'Código incorrecto.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE identity.codigos_verificacion
       SET confirmado_en = now()
     WHERE id = v_fila.id;

    UPDATE identity.perfiles_tecnico
       SET email_verificado_en = now(),
           nivel = CASE WHEN nivel < 1 THEN 1 ELSE nivel END
     WHERE usuario_id = p_usuario_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Paso datos personales: CI y fecha de nacimiento (mayoría de edad).
CREATE OR REPLACE FUNCTION identity.expediente_datos_personales(
    p_usuario_id BIGINT,
    p_ci         VARCHAR,
    p_fecha_nacimiento DATE
) RETURNS VOID AS $$
BEGIN
    IF p_ci IS NULL OR p_ci !~ '^[0-9]{5,15}$' THEN
        RAISE EXCEPTION 'El CI debe tener entre 5 y 15 dígitos.'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_fecha_nacimiento IS NULL
       OR p_fecha_nacimiento > CURRENT_DATE - INTERVAL '18 years' THEN
        RAISE EXCEPTION 'Debés tener al menos 18 años.'
            USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM identity.perfiles_tecnico pt
        JOIN identity.usuarios u ON u.id = pt.usuario_id
        WHERE pt.ci = p_ci
          AND u.eliminado_en IS NULL
          AND pt.usuario_id <> p_usuario_id
    ) THEN
        RAISE EXCEPTION 'Ese CI ya tiene un expediente técnico.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE identity.perfiles_tecnico
       SET ci = p_ci,
           fecha_nacimiento = p_fecha_nacimiento,
           nivel = CASE
                     WHEN ci_frente_url IS NOT NULL AND ci_dorso_url IS NOT NULL
                       THEN GREATEST(nivel, 2)
                     ELSE nivel
                   END
     WHERE usuario_id = p_usuario_id;
END;
$$ LANGUAGE plpgsql;

-- Paso documentos: CI frente/dorso y al menos un certificado técnico.
CREATE OR REPLACE FUNCTION identity.expediente_documentos(
    p_usuario_id          BIGINT,
    p_ci_frente_url       TEXT,
    p_ci_dorso_url        TEXT,
    p_certificaciones_url TEXT[]
) RETURNS VOID AS $$
BEGIN
    IF p_ci_frente_url IS NULL OR p_ci_dorso_url IS NULL THEN
        RAISE EXCEPTION 'Faltan las fotos del CI (frente y dorso).'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_certificaciones_url IS NULL
       OR array_length(p_certificaciones_url, 1) IS NULL
       OR array_length(p_certificaciones_url, 1) = 0 THEN
        RAISE EXCEPTION 'Subí al menos un certificado técnico.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE identity.perfiles_tecnico
       SET ci_frente_url = p_ci_frente_url,
           ci_dorso_url = p_ci_dorso_url,
           certificaciones_url = p_certificaciones_url,
           nivel = CASE
                     WHEN ci IS NOT NULL THEN GREATEST(nivel, 2)
                     ELSE nivel
                   END
     WHERE usuario_id = p_usuario_id;
END;
$$ LANGUAGE plpgsql;

-- Paso especialidades: al menos una categoría activa del catálogo.
CREATE OR REPLACE FUNCTION identity.expediente_especialidades(
    p_usuario_id BIGINT,
    p_categorias INT[]
) RETURNS VOID AS $$
DECLARE
    v_validas INT;
BEGIN
    IF p_categorias IS NULL
       OR array_length(p_categorias, 1) IS NULL
       OR array_length(p_categorias, 1) = 0 THEN
        RAISE EXCEPTION 'Elegí al menos una especialidad.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO v_validas
    FROM unnest(p_categorias) c
    WHERE EXISTS (
        SELECT 1 FROM orders.categorias_servicio cs
        WHERE cs.id = c AND cs.activa
    );

    IF v_validas <> array_length(p_categorias, 1) THEN
        RAISE EXCEPTION 'Elegiste especialidades inexistentes o inactivas.'
            USING ERRCODE = 'P0001';
    END IF;

    DELETE FROM identity.tecnico_especialidades
     WHERE tecnico_id = p_usuario_id;

    INSERT INTO identity.tecnico_especialidades (tecnico_id, categoria_id)
    SELECT p_usuario_id, c FROM unnest(p_categorias) c;
END;
$$ LANGUAGE plpgsql;

-- Paso zonas: barrio + centro + radio; la geometría la arma la base (círculo).
CREATE OR REPLACE FUNCTION identity.expediente_zona(
    p_usuario_id  BIGINT,
    p_nombre_zona VARCHAR,
    p_lat         DOUBLE PRECISION,
    p_lng         DOUBLE PRECISION,
    p_radio_m     NUMERIC
) RETURNS VOID AS $$
BEGIN
    IF p_nombre_zona IS NULL OR btrim(p_nombre_zona) = '' THEN
        RAISE EXCEPTION 'Escribí el nombre de la zona.'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_lat IS NULL OR p_lng IS NULL
       OR p_lat NOT BETWEEN -90 AND 90
       OR p_lng NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'Coordenadas inválidas.'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_radio_m IS NULL OR p_radio_m <= 0 OR p_radio_m > 20000 THEN
        RAISE EXCEPTION 'El radio debe estar entre 1 y 20000 metros.'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO geo.zonas_cobertura (tecnico_id, nombre_zona, poligono, activo)
    VALUES (
        p_usuario_id,
        btrim(p_nombre_zona),
        ST_Buffer(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radio_m),
        TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- Envío a revisión: exige nivel 2 (email + CI + documentos), especialidad y zona.
CREATE OR REPLACE FUNCTION identity.expediente_enviar(p_usuario_id BIGINT)
RETURNS VOID AS $$
DECLARE
    v_nivel  SMALLINT;
    v_estado identity.estado_expediente;
BEGIN
    SELECT nivel, estado_expediente INTO v_nivel, v_estado
    FROM identity.perfiles_tecnico
    WHERE usuario_id = p_usuario_id;

    IF v_nivel IS NULL THEN
        RAISE EXCEPTION 'No hay perfil técnico para esta cuenta.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_estado NOT IN ('borrador', 'observado') THEN
        RAISE EXCEPTION 'El expediente ya está en revisión.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_nivel < 2 THEN
        RAISE EXCEPTION 'Completá tu email, datos personales y documentos antes de enviar.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM identity.tecnico_especialidades e
        WHERE e.tecnico_id = p_usuario_id
    ) THEN
        RAISE EXCEPTION 'Elegí al menos una especialidad.'
            USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM geo.zonas_cobertura z
        WHERE z.tecnico_id = p_usuario_id AND z.activo
    ) THEN
        RAISE EXCEPTION 'Definí al menos una zona de cobertura.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE identity.perfiles_tecnico
       SET estado_expediente = 'en_revision',
           enviado_en = now(),
           observaciones = '{}'::jsonb
     WHERE usuario_id = p_usuario_id;
END;
$$ LANGUAGE plpgsql;

-- Admin: observa campos concretos; el técnico reenvía solo esos.
CREATE OR REPLACE FUNCTION identity.expediente_observar(
    p_admin_id      BIGINT,
    p_tecnico_id    BIGINT,
    p_observaciones JSONB
) RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM identity.usuarios
        WHERE id = p_admin_id AND rol = 'administrador' AND eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'Solo un administrador puede observar un expediente.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE identity.perfiles_tecnico
       SET estado_expediente = 'observado',
           observaciones = COALESCE(p_observaciones, '{}'::jsonb)
     WHERE usuario_id = p_tecnico_id
       AND estado_expediente IN ('en_revision', 'observado');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El expediente no está en revisión.'
            USING ERRCODE = 'P0001';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Técnico: reenvía tras observaciones; borra las observaciones de esos campos.
CREATE OR REPLACE FUNCTION identity.expediente_reenviar(
    p_usuario_id BIGINT,
    p_campos     TEXT[]
) RETURNS VOID AS $$
BEGIN
    UPDATE identity.perfiles_tecnico
       SET estado_expediente = 'en_revision',
           observaciones = observaciones - p_campos
     WHERE usuario_id = p_usuario_id
       AND estado_expediente = 'observado';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No hay observaciones pendientes para este expediente.'
            USING ERRCODE = 'P0001';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Admin: aprueba; habilita nivel 3 y sincroniza estado_validacion (regla de negocio).
CREATE OR REPLACE FUNCTION identity.expediente_aprobar(
    p_admin_id   BIGINT,
    p_tecnico_id BIGINT
) RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM identity.usuarios
        WHERE id = p_admin_id AND rol = 'administrador' AND eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'Solo un administrador puede aprobar un expediente.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE identity.perfiles_tecnico
       SET estado_expediente = 'aprobado',
           estado_validacion = 'aprobado',
           validado_por = p_admin_id,
           fecha_validacion = now(),
           nivel = 3,
           observaciones = '{}'::jsonb
     WHERE usuario_id = p_tecnico_id
       AND estado_expediente = 'en_revision';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El expediente no está en revisión.'
            USING ERRCODE = 'P0001';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Admin: rechaza con motivo.
CREATE OR REPLACE FUNCTION identity.expediente_rechazar(
    p_admin_id   BIGINT,
    p_tecnico_id BIGINT,
    p_motivo     TEXT
) RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM identity.usuarios
        WHERE id = p_admin_id AND rol = 'administrador' AND eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'Solo un administrador puede rechazar un expediente.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE identity.perfiles_tecnico
       SET estado_expediente = 'rechazado',
           estado_validacion = 'rechazado',
           validado_por = p_admin_id,
           fecha_validacion = now(),
           observaciones = jsonb_build_object('motivo', COALESCE(p_motivo, ''))
     WHERE usuario_id = p_tecnico_id
       AND estado_expediente IN ('en_revision', 'observado');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El expediente no está en revisión.'
            USING ERRCODE = 'P0001';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Registro público del técnico (nivel 0, expediente en borrador)
-- =============================================================================
CREATE OR REPLACE FUNCTION identity.registrar_tecnico(
    p_nombre        VARCHAR,
    p_apellido      VARCHAR,
    p_email         VARCHAR,
    p_telefono      VARCHAR,
    p_password_hash VARCHAR
) RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO identity.usuarios (
        rol, nombre, apellido, email, telefono, password_hash, activo, tipo_cliente
    ) VALUES (
        'tecnico'::identity.rol_usuario,
        btrim(p_nombre),
        btrim(p_apellido),
        lower(btrim(p_email)),
        NULLIF(btrim(p_telefono), ''),
        p_password_hash,
        TRUE,
        'persona'::identity.tipo_cliente
    )
    RETURNING id INTO v_id;

    INSERT INTO identity.perfiles_tecnico (usuario_id) VALUES (v_id);

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

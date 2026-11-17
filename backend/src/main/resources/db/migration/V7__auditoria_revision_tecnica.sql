-- V5 ya aplicada: sumar garantías y trazabilidad sin reescribir su checksum.
ALTER TABLE identity.perfiles_tecnico ADD CONSTRAINT ck_tecnico_expediente_completo CHECK (
    NOT expediente_requerido OR nivel < 2 OR (
        email_verificado_en IS NOT NULL AND ci IS NOT NULL AND fecha_nacimiento IS NOT NULL
        AND ci_frente_url IS NOT NULL AND ci_dorso_url IS NOT NULL
        AND COALESCE(cardinality(certificaciones_url),0)>0
    )
);

CREATE TABLE identity.revisiones_tecnico (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tecnico_id BIGINT NOT NULL REFERENCES identity.perfiles_tecnico(usuario_id),
    revisor_id BIGINT NOT NULL REFERENCES identity.usuarios(id),
    decision identity.estado_expediente NOT NULL,
    observaciones JSONB NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION identity.auditar_revision_tecnica() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado_expediente IS DISTINCT FROM OLD.estado_expediente
       AND NEW.estado_expediente IN ('observado','aprobado','rechazado') THEN
        PERFORM identity.validar_revisor(orders.usuario_actual());
        INSERT INTO identity.revisiones_tecnico(tecnico_id,revisor_id,decision,observaciones)
        VALUES(NEW.usuario_id,orders.usuario_actual(),NEW.estado_expediente,NEW.observaciones);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_auditar_revision_tecnica AFTER UPDATE OF estado_expediente
ON identity.perfiles_tecnico FOR EACH ROW EXECUTE FUNCTION identity.auditar_revision_tecnica();

-- No borrar una observación de datos personales si solo se reenvió el mismo valor.
CREATE OR REPLACE FUNCTION identity.expediente_datos_personales(p_id BIGINT,p_ci VARCHAR,p_fecha DATE)
RETURNS VOID AS $$
DECLARE v identity.perfiles_tecnico%ROWTYPE;
BEGIN
    PERFORM identity.expediente_editable(p_id);
    SELECT * INTO v FROM identity.perfiles_tecnico WHERE usuario_id=p_id;
    IF p_ci IS NULL OR upper(btrim(p_ci)) !~ '^[0-9]{5,15}(-[0-9A-Z]{1,3})?$' THEN
        RAISE EXCEPTION 'Ingresá un CI válido, incluido su complemento si corresponde.';
    END IF;
    IF p_fecha IS NULL OR p_fecha > CURRENT_DATE - INTERVAL '18 years'
       OR p_fecha < CURRENT_DATE - INTERVAL '100 years' THEN
        RAISE EXCEPTION 'Debés tener entre 18 y 100 años.';
    END IF;
    UPDATE identity.perfiles_tecnico SET ci=upper(btrim(p_ci)),fecha_nacimiento=p_fecha,
        observaciones=observaciones
          - CASE WHEN ci IS DISTINCT FROM upper(btrim(p_ci)) THEN ARRAY['ci'] ELSE ARRAY[]::TEXT[] END
          - CASE WHEN fecha_nacimiento IS DISTINCT FROM p_fecha THEN ARRAY['fechaNacimiento'] ELSE ARRAY[]::TEXT[] END
    WHERE usuario_id=p_id;
END;
$$ LANGUAGE plpgsql;

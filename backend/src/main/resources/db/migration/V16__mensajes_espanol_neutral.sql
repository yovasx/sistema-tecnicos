-- Corrección editorial únicamente: no modifica datos, permisos ni reglas.
-- V1..V15 permanecen intactas. Se conservan las definiciones vigentes y solo
-- se sustituyen literales completos de mensajes en una lista cerrada de funciones.
-- No se hace sustitución de palabras sobre SQL ni traducción en tiempo de ejecución.
DO $migracion$
DECLARE
    v_funcion TEXT;
    v_original TEXT;
    v_nueva TEXT;
    v_texto RECORD;
BEGIN
    FOREACH v_funcion IN ARRAY ARRAY[
        'identity.expediente_editable',
        'identity.solicitar_codigo_email',
        'identity.expediente_especialidades',
        'identity.expediente_zona',
        'identity.expediente_enviar',
        'identity.expediente_datos_personales',
        'identity.registrar_google',
        'admin_svc.guardar_categoria',
        'admin_svc.editar_usuario',
        'admin_svc.cambiar_estado_usuario',
        'admin_svc.invitar_usuario',
        'orders.crear_solicitud_cliente',
        'identity.editar_perfil'
    ] LOOP
        SELECT pg_get_functiondef(v_funcion::regproc) INTO STRICT v_original;
        v_nueva := v_original;
        FOR v_texto IN SELECT * FROM (VALUES
            ('Alcanzaste el límite de envíos. Intentá dentro de una hora.',
             'Alcanzaste el límite de envíos. Intenta dentro de una hora.'),
            ('Completá la razón social y un NIT de entre 5 y 20 dígitos.',
             'Completa la razón social y un NIT de entre 5 y 20 dígitos.'),
            ('Completá tus datos, las dos caras del CI y un certificado técnico.',
             'Completa tus datos, las dos caras del CI y un certificado técnico.'),
            ('Completá una zona válida y un radio entre 100 y 20000 metros.',
             'Completa una zona válida y un radio entre 100 y 20000 metros.'),
            ('El email ya tiene cuenta. Iniciá sesión con tu contraseña para vincular Google.',
             'Este correo ya tiene una cuenta. Inicia sesión con tu método de acceso habitual.'),
            ('Elegí al menos una especialidad activa del catálogo.',
             'Selecciona al menos una especialidad activa del catálogo.'),
            ('Elegí una especialidad activa y definí tu zona de cobertura.',
             'Selecciona una especialidad activa y define tu zona de cobertura.'),
            ('Esta clave ya corresponde a otra solicitud. Consultá Mis servicios antes de volver a enviar.',
             'Esta clave ya corresponde a otra solicitud. Consulta Mis servicios antes de volver a enviar.'),
            ('Ingresá tarifas entre 0 y 99.999.999,99 con hasta dos decimales.',
             'Ingresa tarifas entre 0 y 99.999.999,99 con hasta dos decimales.'),
            ('Ingresá un CI válido, incluido su complemento si corresponde.',
             'Ingresa un CI válido, incluido su complemento si corresponde.'),
            ('La categoría tiene precios futuros programados. Revisá sus vigencias antes de editarla.',
             'La categoría tiene precios futuros programados. Revisa sus vigencias antes de editarla.'),
            ('La categoría ya no está disponible. Elegí otra categoría activa.',
             'La categoría ya no está disponible. Selecciona otra categoría activa.'),
            ('La cuenta cambió. Recargá el detalle antes de guardar.',
             'La cuenta cambió. Recarga el detalle antes de guardar.'),
            ('La cuenta tiene órdenes en curso. Resolvelas antes de desactivarla.',
             'La cuenta tiene órdenes en curso. Resuélvelas antes de desactivarla.'),
            ('Revisá el nombre, apellido y teléfono.',
             'Revisa el nombre, apellido y teléfono.'),
            ('Revisá la descripción, dirección y coordenadas.',
             'Revisa la descripción, dirección y coordenadas.'),
            ('Revisá los datos de la invitación.',
             'Revisa los datos de la invitación.'),
            ('Revisá los datos y escribí un motivo de entre 5 y 500 caracteres.',
             'Revisa los datos y escribe un motivo de entre 5 y 500 caracteres.'),
            ('Tu cuenta cambió. Recargá el perfil antes de guardar.',
             'Tu cuenta cambió. Recarga el perfil antes de guardar.'),
            ('Usá el perfil administrativo con un motivo de edición.',
             'Usa el perfil administrativo con un motivo de edición.'),
            ('No podés desactivar tu propia cuenta.',
             'No puedes desactivar tu propia cuenta.'),
            ('No podés modificar un expediente enviado, aprobado o rechazado.',
             'No puedes modificar un expediente enviado, aprobado o rechazado.'),
            ('Solo podés editar tu propio perfil.',
             'Solo puedes editar tu propio perfil.')
        ) AS textos(anterior, nuevo) LOOP
            v_nueva := replace(v_nueva, quote_literal(v_texto.anterior), quote_literal(v_texto.nuevo));
        END LOOP;
        IF v_nueva = v_original THEN
            RAISE EXCEPTION 'No se encontró el mensaje esperado en la función %.', v_funcion;
        END IF;
        EXECUTE v_nueva;
    END LOOP;
END;
$migracion$;

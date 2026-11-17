import { View } from 'react-native';
import { adminRepository } from '../../infrastructure/di';
import { useAdminCarga, CargandoAdmin, ErrorAdmin } from './useAdminCarga';
import { Tabla } from '../../ui/desktop/Tabla';
import { Encabezado } from '../../ui/Encabezado';
import { Aviso } from '../../ui/Aviso';
import { espacio } from '../../theme/tokens';

/** W49 · Validación de técnicos: perfiles con estado_validacion = pendiente. */
export function ValidacionAdminScreen() {
  const { datos, cargando, error } = useAdminCarga(() => adminRepository.tecnicosPendientes());

  if (cargando) {
    return <CargandoAdmin />;
  }
  if (error) {
    return <ErrorAdmin mensaje={error} />;
  }

  return (
    <View style={{ gap: espacio.lg }}>
      <Encabezado
        titulo="Validar técnicos"
        subtitulo="Perfiles nuevos esperando aprobación"
      />
      {(datos ?? []).length === 0 ? (
        <Aviso tono="exito" titulo="Nada por validar">
          No hay técnicos pendientes: los sembrados ya están aprobados. Cuando un
          técnico registre su perfil, aparecerá aquí con su documentación.
        </Aviso>
      ) : (
        <Tabla
          columnas={[
            { clave: 'id', titulo: 'ID', ancho: 64 },
            { clave: 'nombre', titulo: 'Técnico', ancho: 220 },
            { clave: 'email', titulo: 'Email' },
            { clave: 'disponibilidad', titulo: 'Disponibilidad', ancho: 150 },
            { clave: 'certificaciones', titulo: 'Certificaciones' },
          ]}
          filas={(datos ?? []).map((t) => [
            String(t.usuarioId),
            t.nombre,
            t.email,
            t.disponibilidad,
            t.certificacionesUrl ?? '—',
          ])}
        />
      )}
    </View>
  );
}

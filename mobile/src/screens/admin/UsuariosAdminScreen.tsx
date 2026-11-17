import { View } from 'react-native';
import { adminRepository } from '../../infrastructure/di';
import { useAdminCarga, CargandoAdmin, ErrorAdmin } from './useAdminCarga';
import { Tabla } from '../../ui/desktop/Tabla';
import { Encabezado } from '../../ui/Encabezado';
import { fechaCorta, siNo } from '../../ui/formato';
import { espacio } from '../../theme/tokens';

/** W48 · Usuarios: listado real de identity.usuarios (sin hash, siempre). */
export function UsuariosAdminScreen() {
  const { datos, cargando, error } = useAdminCarga(() => adminRepository.usuarios());

  if (cargando) {
    return <CargandoAdmin />;
  }
  if (error) {
    return <ErrorAdmin mensaje={error} />;
  }

  return (
    <View style={{ gap: espacio.lg }}>
      <Encabezado
        titulo="Usuarios"
        subtitulo={`${datos?.length ?? 0} cuentas activas`}
      />
      <Tabla
        columnas={[
          { clave: 'id', titulo: 'ID', ancho: 64 },
          { clave: 'nombre', titulo: 'Nombre', ancho: 240 },
          { clave: 'email', titulo: 'Email' },
          { clave: 'rol', titulo: 'Rol', ancho: 130 },
          { clave: 'perfil', titulo: 'Perfil', ancho: 110 },
          { clave: 'activo', titulo: 'Activo', ancho: 90 },
          { clave: 'creado', titulo: 'Creado', ancho: 120 },
        ]}
        filas={(datos ?? []).map((u) => [
          String(u.id),
          u.nombre,
          u.email,
          u.rol,
          u.tipoCliente,
          siNo(u.activo),
          fechaCorta(u.creadoEn),
        ])}
      />
    </View>
  );
}

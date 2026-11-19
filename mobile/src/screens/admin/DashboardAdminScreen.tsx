import { View } from 'react-native';
import { adminRepository } from '../../infrastructure/di';
import { useAdminCarga, CargandoAdmin, ErrorAdmin } from './useAdminCarga';
import { TarjetaMetrica } from '../../ui/desktop/TarjetaMetrica';
import { Tabla } from '../../ui/desktop/Tabla';
import { Texto } from '../../ui/Texto';
import { Encabezado } from '../../ui/Encabezado';
import { Aviso } from '../../ui/Aviso';
import { fechaCorta } from '../../ui/formato';
import { espacio } from '../../theme/tokens';

/** W42 · Dashboard del backoffice, con métricas reales del endpoint /resumen. */
export function DashboardAdminScreen() {
  const resumen = useAdminCarga(() => adminRepository.resumen());
  const usuarios = useAdminCarga(() => adminRepository.usuarios());

  if (resumen.cargando || usuarios.cargando) {
    return <CargandoAdmin />;
  }
  if (resumen.error) {
    return <ErrorAdmin mensaje={resumen.error} />;
  }

  const r = resumen.datos!;
  const ultimos = (usuarios.datos ?? []).slice(-5).reverse();

  return (
    <View style={{ gap: espacio.lg }}>
      <Encabezado
        titulo="Dashboard"
        subtitulo="Plataforma en vivo · datos reales de la base"
      />

      <View style={estilo.grilla}>
        <TarjetaMetrica etiqueta="Usuarios" valor={String(r.totalUsuarios)} detalle={`${r.clientes} clientes · ${r.administradores} admin`} tono="marca" />
        <TarjetaMetrica etiqueta="Técnicos aprobados" valor={String(r.tecnicosAprobados)} detalle={`${r.tecnicosPendientes} pendientes de validar`} tono="exito" />
        <TarjetaMetrica etiqueta="Categorías activas" valor={String(r.categoriasActivas)} detalle="con tarifa y comisión" />
        <TarjetaMetrica etiqueta="Clientes" valor={String(r.clientes)} detalle="personas + empresas" tono="advertencia" />
      </View>

      <Aviso tono="info" titulo="Tu centro de administración">
        Gestioná cuentas en Usuarios, revisá expedientes en Validar técnicos y
        actualizá tarifas en Catálogo. Las operaciones de órdenes y finanzas todavía están pendientes.
      </Aviso>

      <Texto variante="subtitulo">Últimos usuarios</Texto>
      <Tabla
        columnas={[
          { clave: 'id', titulo: 'ID', ancho: 64 },
          { clave: 'nombre', titulo: 'Nombre', ancho: 240 },
          { clave: 'email', titulo: 'Email' },
          { clave: 'rol', titulo: 'Rol', ancho: 130 },
          { clave: 'creado', titulo: 'Creado', ancho: 120 },
        ]}
        filas={ultimos.map((u) => [
          String(u.id),
          u.nombre,
          u.email,
          u.rol,
          fechaCorta(u.creadoEn),
        ])}
      />
    </View>
  );
}

const estilo = {
  grilla: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: espacio.base,
  },
};

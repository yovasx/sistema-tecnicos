import { View } from 'react-native';
import { adminRepository } from '../../infrastructure/di';
import { useAdminCarga, CargandoAdmin, ErrorAdmin } from './useAdminCarga';
import { Tabla } from '../../ui/desktop/Tabla';
import { Encabezado } from '../../ui/Encabezado';
import { bolivianos } from '../../ui/formato';
import { espacio } from '../../theme/tokens';

/** W52 · Catálogo: categorías con tarifa, recargo de urgencia y comisión. */
export function CatalogoAdminScreen() {
  const { datos, cargando, error } = useAdminCarga(() => adminRepository.categorias());

  if (cargando) {
    return <CargandoAdmin />;
  }
  if (error) {
    return <ErrorAdmin mensaje={error} />;
  }

  return (
    <View style={{ gap: espacio.lg }}>
      <Encabezado
        titulo="Catálogo"
        subtitulo="Categorías, tarifas base y comisión de la plataforma"
      />
      <Tabla
        columnas={[
          { clave: 'nombre', titulo: 'Categoría', ancho: 190 },
          { clave: 'descripcion', titulo: 'Descripción' },
          { clave: 'visita', titulo: 'Visita', ancho: 120 },
          { clave: 'hora', titulo: 'Hora', ancho: 120 },
          { clave: 'urgencia', titulo: 'Urgencia', ancho: 110 },
          { clave: 'comision', titulo: 'Comisión', ancho: 110 },
        ]}
        filas={(datos ?? []).map((c) => [
          c.nombre,
          c.descripcion ?? '—',
          bolivianos(c.tarifaVisita),
          bolivianos(c.tarifaHora),
          c.recargoUrgenciaPct === null ? '—' : `${c.recargoUrgenciaPct}%`,
          c.comisionPct === null ? '—' : `${c.comisionPct}%`,
        ])}
      />
    </View>
  );
}

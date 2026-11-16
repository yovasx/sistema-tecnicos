import { PantallaPendiente } from '../../ui/PantallaPendiente';

/** F26: cotizaciones, pagos y comprobantes ya están modelados en billing. */
export function FacturacionEmpresa() {
  return (
    <PantallaPendiente
      titulo="Facturación"
      descripcion="Comprobantes con NIT y razón social, cotizaciones aceptadas y liquidaciones. La base ya tiene billing.responder_cotizacion y el estado de liquidaciones; falta el endpoint."
      pantallaStitch="Fixly · Pagos y comprobantes (F26)"
    />
  );
}

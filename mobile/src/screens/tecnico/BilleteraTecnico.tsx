import { PantallaPendiente } from '../../ui/PantallaPendiente';

/** F35: la billetera piden billing.liquidaciones, todavía sin endpoint. */
export function BilleteraTecnico() {
  return (
    <PantallaPendiente
      titulo="Billetera"
      descripcion="Saldo disponible, retiros (F36), liquidaciones y la comisión del 15% de la plataforma. Los estados de liquidación ya existen en billing; falta el endpoint."
      pantallaStitch="Fixly · Billetera del técnico (F35)"
    />
  );
}

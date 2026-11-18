import { useRentalPrices } from "../../hooks/useRentalPrices";
import { formatDocumentCurrency } from "../../utils/documentPresentation";

export default function RentalRate({ equipmentId }: { equipmentId: string }) {
  const { rows, loading } = useRentalPrices();
  const row = rows.find(item => item.equipment_id === equipmentId);
  if (loading) return <span className="text-base">Loading rates…</span>;
  if (!row) return <span className="text-base">Contact for pricing</span>;
  return <>{formatDocumentCurrency(Math.min(...row.rates.map(rate => rate.price)))}</>;
}

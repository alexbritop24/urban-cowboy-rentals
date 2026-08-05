import type { RentalRequestItemDraft } from "../../domain/models/rentalRequestWorkflow";
import {
  calculateLineTotal,
  calculateRentalDays,
  calculateSubtotal,
} from "../../domain/pricing/rentalPricing";

interface RentalPricingSummaryProps {
  items: readonly RentalRequestItemDraft[];
  showPendingFees?: boolean;
}

const calculateSafeSubtotal = (items: readonly RentalRequestItemDraft[]) => {
  try {
    return calculateSubtotal(
      items.map((item) => {
        const days = calculateRentalDays(item.startDate, item.endDate);
        return {
          lineTotal: calculateLineTotal(item.dailyRate, days, item.quantity),
        };
      })
    );
  } catch {
    return null;
  }
};

export default function RentalPricingSummary({
  items,
  showPendingFees = true,
}: RentalPricingSummaryProps) {
  const subtotal = calculateSafeSubtotal(items);

  return (
    <aside className="rounded-3xl border border-yellow-500/20 bg-[#f4b000]/5 p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
        Estimated pricing
      </p>

      <dl className="mt-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#b8a99a]">Equipment subtotal</dt>
          <dd className="font-black text-[#fff7ed]">
            {subtotal === null ? "—" : `$${subtotal.toFixed(2)}`}
          </dd>
        </div>

        {showPendingFees && (
          <>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#b8a99a]">Delivery</dt>
              <dd className="font-bold text-[#fff7ed]">Pending review</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#b8a99a]">Tax</dt>
              <dd className="font-bold text-[#fff7ed]">Pending review</dd>
            </div>
          </>
        )}
      </dl>

      <p className="mt-5 border-t border-yellow-500/10 pt-5 text-sm leading-6 text-[#b8a99a]">
        This is an estimate. Urban Cowboy Rentals will confirm availability,
        billable days, delivery, taxes, and final pricing.
      </p>
    </aside>
  );
}

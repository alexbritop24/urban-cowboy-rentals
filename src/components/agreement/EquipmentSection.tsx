import type { RentalAgreement } from "../../types/agreement";

interface EquipmentSectionProps {
  agreement: RentalAgreement;
}

const currency = (value: number) => `$${value.toFixed(2)}`;

const EquipmentSection = ({ agreement }: EquipmentSectionProps) => (
  <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6 lg:col-span-2">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
          Agreement Equipment
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">
          {agreement.items.length} item{agreement.items.length === 1 ? "" : "s"}
        </h2>
      </div>
      <p className="text-sm text-[#b8a99a]">
        {agreement.rental_start_date || "—"} → {agreement.rental_end_date || "—"}
      </p>
    </div>

    <div className="mt-6 overflow-x-auto">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead className="border-b border-yellow-500/20 text-xs uppercase tracking-[0.1em] text-[#8f8577]">
          <tr>
            <th className="px-3 py-3">Equipment</th>
            <th className="px-3 py-3">Serial</th>
            <th className="px-3 py-3">Rental Period</th>
            <th className="px-3 py-3 text-right">Qty</th>
            <th className="px-3 py-3 text-right">Daily Rate</th>
            <th className="px-3 py-3 text-right">Days</th>
            <th className="px-3 py-3 text-right">Line Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-yellow-500/10">
          {agreement.items.map((item) => (
            <tr key={item.id} className="align-top text-[#d8cfc4]">
              <td className="px-3 py-4">
                <p className="font-bold text-[#fff7ed]">{item.equipmentName}</p>
                {item.notes && <p className="mt-1 text-xs text-[#8f8577]">{item.notes}</p>}
              </td>
              <td className="px-3 py-4">{item.serialNumber || "—"}</td>
              <td className="px-3 py-4">
                {item.startDate} → {item.endDate}
              </td>
              <td className="px-3 py-4 text-right">{item.quantity}</td>
              <td className="px-3 py-4 text-right">{currency(item.dailyRate)}</td>
              <td className="px-3 py-4 text-right">{item.billableDays}</td>
              <td className="px-3 py-4 text-right font-bold text-[#fff7ed]">
                {currency(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default EquipmentSection;

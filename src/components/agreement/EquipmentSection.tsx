import type { RentalAgreement } from "../../types/agreement";
import {
  formatDocumentCurrency,
  formatDocumentDate,
} from "../../utils/documentPresentation";
import { sanitizeInvoicePdfText } from "./pdf/sanitizeInvoicePdfText";

interface EquipmentSectionProps {
  agreement: RentalAgreement;
}

const EquipmentSection = ({ agreement }: EquipmentSectionProps) => (
  <section className="document-section border-t border-[#d8d0c6] pt-6 lg:col-span-2">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
          Equipment Schedule
        </p>
        <h2 className="mt-1 font-serif text-xl font-bold text-[#211d18]">
          {agreement.items.length} rental item{agreement.items.length === 1 ? "" : "s"}
        </h2>
      </div>
      <p className="text-sm text-[#5f574f]">
        {formatDocumentDate(agreement.rental_start_date)} →{" "}
        {formatDocumentDate(agreement.rental_end_date)}
      </p>
    </div>

    <div className="document-table-scroll mt-6 overflow-x-auto">
      <table className="document-data-table w-full min-w-[980px] border-collapse border border-[#d8d0c6] text-left text-sm">
        <thead className="bg-[#f4eee5] text-xs uppercase tracking-[0.08em] text-[#5f574f]">
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
        <tbody className="divide-y divide-[#d8d0c6]">
          {agreement.items.map((item) => (
            <tr key={item.id} className="align-top text-[#211d18]">
              <td className="px-3 py-4">
                <p className="font-bold text-[#211d18]">{item.equipmentName}</p>
                {item.notes && (
                  <p className="mt-1 text-xs text-[#6f665c]">
                    {sanitizeInvoicePdfText(item.notes)}
                  </p>
                )}
              </td>
              <td className="px-3 py-4">{item.serialNumber || "—"}</td>
              <td className="px-3 py-4">
                {formatDocumentDate(item.startDate)} →{" "}
                {formatDocumentDate(item.endDate)}
              </td>
              <td className="px-3 py-4 text-right">{item.quantity}</td>
              <td className="px-3 py-4 text-right">
                {formatDocumentCurrency(item.dailyRate)}
              </td>
              <td className="px-3 py-4 text-right">{item.billableDays}</td>
              <td className="px-3 py-4 text-right font-bold text-[#211d18]">
                {formatDocumentCurrency(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default EquipmentSection;

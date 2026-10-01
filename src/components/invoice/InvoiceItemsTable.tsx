import type { Invoice } from "../../types/invoice";
import { formatDocumentCurrency } from "../../utils/documentPresentation";
import { formatInvoiceDate } from "../../utils/invoicePresentation";
import { sanitizeInvoicePdfText } from "../agreement/pdf/sanitizeInvoicePdfText";

export default function InvoiceItemsTable({ invoice }: { invoice: Invoice }) {
  const isLegacy = invoice.item_source !== "normalized";

  return (
    <section className="document-section border-t border-[#d8d0c6] pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
            Itemized Rental
          </p>
          <h2 className="mt-1 font-serif text-xl font-bold text-[#211d18]">
            {invoice.items.length} item{invoice.items.length === 1 ? "" : "s"}
          </h2>
        </div>
        <p className="text-sm text-[#5f574f]">Payment terms: {invoice.payment_terms}</p>
      </div>

      {isLegacy && (
        <p className="mt-5 border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          This historical Invoice has no normalized item snapshot. Only stored
          legacy information is shown; unavailable quantities, rates, serial
          numbers, and dates are not reconstructed.
        </p>
      )}

      {invoice.items.length === 0 ? (
        <p className="mt-6 text-[#5f574f]">
          Historical item details are unavailable for this Invoice.
        </p>
      ) : (
        <div className="document-table-scroll mt-6 max-w-full overflow-x-auto pb-2">
          <table className="document-data-table w-full min-w-[900px] table-fixed border-collapse border border-[#d8d0c6] text-left text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="bg-[#f4eee5] text-xs uppercase tracking-[0.08em] text-[#5f574f]">
              <tr>
                <th className="px-3 py-3">Equipment</th>
                <th className="px-3 py-3">Serial</th>
                <th className="px-3 py-3">Rental period</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Daily rate</th>
                <th className="px-3 py-3 text-right">Days</th>
                <th className="px-3 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d8d0c6]">
              {invoice.items.map((item) => (
                <tr key={item.id} className="align-top text-[#211d18]">
                  <td className="break-words px-3 py-4">
                    <p className="font-bold leading-5 text-[#211d18]">
                      {item.equipmentName}
                    </p>
                    {item.notes && (
                      <p className="mt-1 break-words text-xs leading-5 text-[#6f665c]">
                        {sanitizeInvoicePdfText(item.notes)}
                      </p>
                    )}
                  </td>
                  <td className="break-all px-3 py-4 text-xs leading-5">
                    {item.serialNumber || "Not recorded"}
                  </td>
                  <td className="px-3 py-4 text-xs leading-5">
                    {formatInvoiceDate(item.startDate)} →{" "}
                    {formatInvoiceDate(item.endDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right">
                    {isLegacy ? "N/A" : item.quantity}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right">
                    {isLegacy
                      ? "Not recorded"
                      : formatDocumentCurrency(item.dailyRate, invoice.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right">
                    {isLegacy ? "Not recorded" : item.billableDays}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right font-bold text-[#211d18]">
                    {formatDocumentCurrency(item.lineTotal, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

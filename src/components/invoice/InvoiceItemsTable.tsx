import type { Invoice } from "../../types/invoice";
import { formatInvoiceDate } from "../../utils/invoicePresentation";

const currency = (value: number, currencyCode: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(value);

export default function InvoiceItemsTable({ invoice }: { invoice: Invoice }) {
  const isLegacy = invoice.item_source !== "normalized";

  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
            Invoice Items
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">
            {invoice.items.length} item{invoice.items.length === 1 ? "" : "s"}
          </h2>
        </div>
        <p className="text-sm text-[#b8a99a]">Payment terms: {invoice.payment_terms}</p>
      </div>

      {isLegacy && (
        <p className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          This historical Invoice has no normalized item snapshot. Only stored
          legacy information is shown; unavailable quantities, rates, serial
          numbers, and dates are not reconstructed.
        </p>
      )}

      {invoice.items.length === 0 ? (
        <p className="mt-6 text-[#b8a99a]">
          Historical item details are unavailable for this Invoice.
        </p>
      ) : (
        <div className="mt-6 max-w-full overflow-x-auto pb-2">
          <table className="w-full min-w-[900px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="border-b border-yellow-500/20 text-xs uppercase tracking-[0.1em] text-[#8f8577]">
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
            <tbody className="divide-y divide-yellow-500/10">
              {invoice.items.map((item) => (
                <tr key={item.id} className="align-top text-[#d8cfc4]">
                  <td className="break-words px-3 py-4">
                    <p className="font-bold leading-5 text-[#fff7ed]">
                      {item.equipmentName}
                    </p>
                    {item.notes && (
                      <p className="mt-1 break-words text-xs leading-5 text-[#8f8577]">
                        {item.notes}
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
                    {isLegacy ? "Not recorded" : currency(item.dailyRate, invoice.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right">
                    {isLegacy ? "Not recorded" : item.billableDays}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right font-bold text-[#fff7ed]">
                    {currency(item.lineTotal, invoice.currency)}
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

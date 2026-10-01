import type { Invoice } from "../../types/invoice";
import { formatDocumentCurrency } from "../../utils/documentPresentation";

interface InvoiceFinancialSummaryProps {
  invoice: Invoice;
}

const currency = (value: number | null | undefined, currencyCode: string) =>
  formatDocumentCurrency(Number(value || 0), currencyCode);

const InvoiceFinancialSummary = ({ invoice }: InvoiceFinancialSummaryProps) => {
  const amount = (value: number) => currency(value, invoice.currency);

  return (
    <section className="document-section document-totals border-t border-[#d8d0c6] pt-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
          Charges and Balance
        </p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-[#211d18]">
          Invoice Summary
        </h2>
        <p className="mt-2 text-sm text-[#6f665c]">
          These amounts were copied from the finalized Agreement snapshot.
        </p>
      </div>

      <div className="mt-6 ml-auto max-w-xl space-y-2">
        <SummaryRow label="Rental subtotal" value={amount(invoice.subtotal)} />
        <SummaryRow label="Deposit required" value={amount(invoice.deposit_amount)} />
        <SummaryRow label="Delivery" value={amount(invoice.delivery_fee)} />
        <SummaryRow label="Sales tax" value={amount(invoice.tax_amount)} />
        {invoice.other_charges_amount > 0 && (
          <SummaryRow
            label="Other approved charges"
            value={amount(invoice.other_charges_amount)}
          />
        )}
      </div>

      <div className="my-6 border-t border-[#9a6a28]" />

      <div className="ml-auto grid max-w-2xl gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={amount(invoice.total_amount)} />
        <SummaryCard label="Paid" value={amount(invoice.amount_paid)} />
        <SummaryCard label="Balance Due" value={amount(invoice.balance_due)} />
      </div>
    </section>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-[#e4ddd4] px-1 py-3">
    <span className="text-sm font-bold uppercase tracking-[0.1em] text-[#6f665c]">
      {label}
    </span>
    <span className="text-lg font-bold text-[#211d18]">{value}</span>
  </div>
);

interface SummaryCardProps {
  label: string;
  value: string;
}

const SummaryCard = ({ label, value }: SummaryCardProps) => (
  <div className="border border-[#d8d0c6] bg-[#faf7f2] p-4">
    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6f665c]">
      {label}
    </p>
    <p className="mt-2 text-xl font-black text-[#211d18]">{value}</p>
  </div>
);

export default InvoiceFinancialSummary;

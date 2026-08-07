import type { Invoice } from "../../types/invoice";

interface InvoiceFinancialSummaryProps {
  invoice: Invoice;
}

const currency = (value: number | null | undefined, currencyCode: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(Number(value || 0));

const InvoiceFinancialSummary = ({ invoice }: InvoiceFinancialSummaryProps) => {
  const amount = (value: number) => currency(value, invoice.currency);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[#11100d] p-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
          Financial Summary
        </p>
        <h2 className="mt-2 text-3xl font-black text-[#fff7ed]">
          Immutable Invoice Charges
        </h2>
        <p className="mt-2 text-sm text-[#8f8577]">
          These amounts were copied from the finalized Agreement snapshot.
        </p>
      </div>

      <div className="mt-8 space-y-4">
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

      <div className="my-8 border-t border-yellow-500/20" />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total" value={amount(invoice.total_amount)} />
        <SummaryCard label="Paid" value={amount(invoice.amount_paid)} />
        <SummaryCard label="Balance Due" value={amount(invoice.balance_due)} />
      </div>
    </section>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-yellow-500/10 bg-black/30 px-5 py-4">
    <span className="text-sm font-black uppercase tracking-[0.12em] text-[#8f8577]">
      {label}
    </span>
    <span className="text-xl font-bold text-[#fff7ed]">{value}</span>
  </div>
);

interface SummaryCardProps {
  label: string;
  value: string;
}

const SummaryCard = ({ label, value }: SummaryCardProps) => (
  <div className="rounded-2xl border border-yellow-500/10 bg-black/30 p-5">
    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
      {label}
    </p>
    <p className="mt-2 text-2xl font-black text-[#fff7ed]">{value}</p>
  </div>
);

export default InvoiceFinancialSummary;

import type { Invoice } from "../../types/invoice";

interface InvoiceFinancialSummaryProps {
  invoice: Invoice;
  isSaving: boolean;
  notice: string;
  onFieldChange: (
    field: "subtotal" | "deposit_amount" | "delivery_fee" | "tax_amount",
    value: number
  ) => void;
}

const currency = (value: number | null | undefined) =>
  `$${Number(value || 0).toFixed(2)}`;

const InvoiceFinancialSummary = ({
  invoice,
  isSaving,
  notice,
  onFieldChange,
}: InvoiceFinancialSummaryProps) => {
  const isLocked = invoice.status !== "draft";

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[#11100d] p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
            Financial Summary
          </p>

          <h2 className="mt-2 text-3xl font-black text-[#fff7ed]">
            Invoice Charges
          </h2>
        </div>

        <p className="text-sm font-bold text-[#8f8577]">
          {isSaving ? "Saving..." : notice}
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <FinancialInput
          label="Rental"
          value={invoice.subtotal}
          disabled={isLocked}
          onChange={(value) => onFieldChange("subtotal", value)}
        />

        <FinancialInput
          label="Deposit"
          value={invoice.deposit_amount}
          disabled={isLocked}
          onChange={(value) => onFieldChange("deposit_amount", value)}
        />

        <FinancialInput
          label="Delivery Fee"
          value={invoice.delivery_fee}
          disabled={isLocked}
          onChange={(value) => onFieldChange("delivery_fee", value)}
        />

        <FinancialInput
          label="Sales Tax"
          value={invoice.tax_amount}
          disabled={isLocked}
          onChange={(value) => onFieldChange("tax_amount", value)}
        />
      </div>

      <div className="my-8 border-t border-yellow-500/20" />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total" value={currency(invoice.total_amount)} />
        <SummaryCard label="Paid" value={currency(invoice.amount_paid)} />
        <SummaryCard label="Balance Due" value={currency(invoice.balance_due)} />
      </div>
    </section>
  );
};

interface FinancialInputProps {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

const FinancialInput = ({
  label,
  value,
  disabled,
  onChange,
}: FinancialInputProps) => {
  return (
    <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
      <label className="text-sm font-black uppercase tracking-[0.12em] text-[#8f8577]">
        {label}
      </label>

      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="rounded-2xl border border-yellow-500/10 bg-black/40 px-5 py-4 text-right text-xl font-bold text-[#fff7ed] outline-none transition focus:border-yellow-500/40 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  value: string;
}

const SummaryCard = ({ label, value }: SummaryCardProps) => {
  return (
    <div className="rounded-2xl border border-yellow-500/10 bg-black/30 p-5">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-[#fff7ed]">
        {value}
      </p>
    </div>
  );
};

export default InvoiceFinancialSummary;
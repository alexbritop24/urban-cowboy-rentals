import type { RentalAgreement } from "../../types/agreement";

interface PricingSummaryProps {
  agreement: RentalAgreement;
  isSaving: boolean;
  notice: string;
  updateFinancialField: (
    field: "quote_amount" | "deposit_amount" | "delivery_fee" | "tax_amount",
    value: number
  ) => void;
}

const currency = (value: number | null | undefined) =>
  `$${Number(value || 0).toFixed(2)}`;

const PricingSummary = ({
  agreement,
  isSaving,
  notice,
  updateFinancialField,
}: PricingSummaryProps) => {
  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[#11100d] p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
            Financial Summary
          </p>

          <h2 className="mt-2 text-3xl font-black text-[#fff7ed]">
            Rental Charges
          </h2>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold text-[#8f8577]">
            {isSaving ? "Saving..." : notice}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-6">

        <FinancialInput
          label="Equipment Rental"
          value={agreement.quote_amount}
          onChange={(value) =>
            updateFinancialField("quote_amount", value)
          }
        />

        <FinancialInput
          label="Deposit"
          value={agreement.deposit_amount}
          onChange={(value) =>
            updateFinancialField("deposit_amount", value)
          }
        />

        <FinancialInput
          label="Delivery Fee"
          value={agreement.delivery_fee}
          onChange={(value) =>
            updateFinancialField("delivery_fee", value)
          }
        />

        <FinancialInput
          label="Sales Tax"
          value={agreement.tax_amount}
          onChange={(value) =>
            updateFinancialField("tax_amount", value)
          }
        />

      </div>

      <div className="my-8 border-t border-yellow-500/20" />

      <div className="flex items-center justify-between rounded-2xl bg-[#f4b000]/10 px-6 py-5">

        <div>

          <p className="text-xs uppercase tracking-[0.18em] text-[#8f8577]">
            Total Due
          </p>

          <p className="mt-1 text-4xl font-black text-[#fff7ed]">
            {currency(agreement.total_amount)}
          </p>

        </div>

      </div>
    </section>
  );
};

interface FinancialInputProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

const FinancialInput = ({
  label,
  value,
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
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="rounded-2xl border border-yellow-500/10 bg-black/40 px-5 py-4 text-right text-xl font-bold text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
      />

    </div>
  );
};

export default PricingSummary;
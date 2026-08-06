import type { EditableAgreementFinancialField } from "../../services/agreementService";
import type { RentalAgreement } from "../../types/agreement";

interface PricingSummaryProps {
  agreement: RentalAgreement;
  isSaving: boolean;
  notice: string;
  isLocked: boolean;
  updateFinancialField: (
    field: EditableAgreementFinancialField,
    value: number
  ) => void;
}

const currency = (value: number | null | undefined) =>
  `$${Number(value || 0).toFixed(2)}`;

const PricingSummary = ({
  agreement,
  isSaving,
  notice,
  isLocked,
  updateFinancialField,
}: PricingSummaryProps) => (
  <section className="rounded-3xl border border-yellow-500/20 bg-[#11100d] p-8">
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
          Financial Summary
        </p>
        <h2 className="mt-2 text-3xl font-black text-[#fff7ed]">Rental Charges</h2>
      </div>
      <p className="text-right text-sm font-bold text-[#8f8577]">
        {isSaving ? "Saving..." : notice}
      </p>
    </div>

    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-yellow-500/10 bg-black/30 px-5 py-4">
        <span className="text-sm font-black uppercase tracking-[0.12em] text-[#8f8577]">
          Immutable Item Subtotal
        </span>
        <span className="text-xl font-bold text-[#fff7ed]">
          {currency(agreement.quote_amount)}
        </span>
      </div>

      <FinancialInput
        label="Deposit"
        value={agreement.deposit_amount}
        disabled={isLocked}
        onChange={(value) => updateFinancialField("deposit_amount", value)}
      />
      <FinancialInput
        label="Delivery Fee"
        value={agreement.delivery_fee}
        disabled={isLocked}
        onChange={(value) => updateFinancialField("delivery_fee", value)}
      />
      <FinancialInput
        label="Sales Tax"
        value={agreement.tax_amount}
        disabled={isLocked}
        onChange={(value) => updateFinancialField("tax_amount", value)}
      />
    </div>

    <div className="my-8 border-t border-yellow-500/20" />
    <div className="flex items-center justify-between rounded-2xl bg-[#f4b000]/10 px-6 py-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#8f8577]">Total Due</p>
        <p className="mt-1 text-4xl font-black text-[#fff7ed]">
          {currency(agreement.total_amount)}
        </p>
      </div>
    </div>
  </section>
);

interface FinancialInputProps {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

const FinancialInput = ({ label, value, disabled, onChange }: FinancialInputProps) => (
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
      className="rounded-2xl border border-yellow-500/10 bg-black/40 px-5 py-4 text-right text-xl font-bold text-[#fff7ed] outline-none transition focus:border-yellow-500/40 disabled:cursor-not-allowed disabled:opacity-60"
    />
  </div>
);

export default PricingSummary;

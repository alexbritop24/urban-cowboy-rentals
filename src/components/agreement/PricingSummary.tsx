import type { EditableAgreementFinancialField } from "../../services/agreementService";
import type { RentalAgreement } from "../../types/agreement";
import { formatDocumentCurrency } from "../../utils/documentPresentation";

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
  formatDocumentCurrency(Number(value || 0));

const PricingSummary = ({
  agreement,
  isSaving,
  notice,
  isLocked,
  updateFinancialField,
}: PricingSummaryProps) => (
  <section className="document-section document-totals border-t border-[#d8d0c6] pt-7">
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76572f]">
          Rental Charges
        </p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-[#211d18]">Financial Summary</h2>
      </div>
      <p className="document-no-print text-right text-sm font-bold text-[#6f665c]">
        {isSaving ? "Saving..." : notice}
      </p>
    </div>

    <div className="mt-6 ml-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between border-b border-[#e4ddd4] px-1 py-3">
        <span className="text-sm font-bold uppercase tracking-[0.1em] text-[#6f665c]">
          Rental Subtotal
        </span>
        <span className="text-lg font-bold text-[#211d18]">
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

    <div className="my-6 border-t border-[#9a6a28]" />
    <div className="ml-auto flex max-w-xl items-center justify-between bg-[#f4eee5] px-5 py-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[#6f665c]">Total Due</p>
        <p className="mt-1 text-3xl font-black text-[#211d18]">
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
  <div className="grid items-center gap-4 border-b border-[#e4ddd4] px-1 py-2 md:grid-cols-[220px_1fr]">
    <label className="text-sm font-bold uppercase tracking-[0.1em] text-[#6f665c]">
      {label}
    </label>
    <div>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="document-screen-only w-full border border-[#b8afa4] bg-white px-4 py-3 text-right text-lg font-bold text-[#211d18] outline-none transition focus:border-[#9a6a28] disabled:cursor-not-allowed disabled:bg-[#f4eee5] disabled:opacity-70"
      />
      <p className="document-print-only text-right text-xl font-bold">
        {formatDocumentCurrency(value)}
      </p>
    </div>
  </div>
);

export default PricingSummary;

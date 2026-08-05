import type { DomainValidationIssue } from "../../domain/errors/DomainValidationError";
import type { RentalRequestItemDraft } from "../../domain/models/rentalRequestWorkflow";
import {
  prepareRentalRequestItemPricing,
  selectRentalRequestDraftEquipment,
} from "../../services/rentalRequestFormService";
import type { EquipmentItem } from "../../types/equipment";

interface RentalItemEditorProps {
  item: RentalRequestItemDraft;
  index: number;
  equipmentOptions: readonly EquipmentItem[];
  issues?: readonly DomainValidationIssue[];
  onChange: (item: RentalRequestItemDraft) => void;
  onRemove: () => void;
}

const getIssue = (
  issues: readonly DomainValidationIssue[],
  pathSuffix: string
): string | null =>
  issues.find((issue) => issue.path.endsWith(pathSuffix))?.message ?? null;

export default function RentalItemEditor({
  item,
  index,
  equipmentOptions,
  issues = [],
  onChange,
  onRemove,
}: RentalItemEditorProps) {
  const pricing = prepareRentalRequestItemPricing(item);
  const equipmentError =
    getIssue(issues, ".equipmentId") ?? getIssue(issues, ".equipmentName");
  const startDateError = getIssue(issues, ".rentalPeriod.startDate");
  const endDateError = getIssue(issues, ".rentalPeriod.endDate");
  const dateRangeError = getIssue(issues, ".rentalPeriod");
  const quantityError = getIssue(issues, ".quantity");
  const rateError = getIssue(issues, ".dailyRate");

  const updateEquipment = (equipmentId: string) => {
    onChange(selectRentalRequestDraftEquipment(item, equipmentId));
  };

  return (
    <article className="rounded-3xl border border-yellow-500/10 bg-black/25 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
            Equipment item {index + 1}
          </p>
          <p className="mt-2 text-sm text-[#b8a99a]">
            Dates and pricing apply only to this item.
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="w-fit rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-red-300 transition hover:border-red-500/50"
        >
          Remove
        </button>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Equipment
          </span>
          <select
            value={item.equipmentId}
            onChange={(event) => updateEquipment(event.target.value)}
            aria-invalid={Boolean(equipmentError)}
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
          >
            <option value="">Select equipment</option>
            {equipmentOptions.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
              </option>
            ))}
          </select>
          {equipmentError && (
            <span className="mt-2 block text-sm text-red-300">{equipmentError}</span>
          )}
        </label>

        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Start date and time
          </span>
          <input
            type="datetime-local"
            value={item.startDate}
            onChange={(event) => onChange({ ...item, startDate: event.target.value })}
            aria-invalid={Boolean(startDateError || dateRangeError)}
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
          />
          {(startDateError || dateRangeError) && (
            <span className="mt-2 block text-sm text-red-300">
              {startDateError || dateRangeError}
            </span>
          )}
        </label>

        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            End date and time
          </span>
          <input
            type="datetime-local"
            value={item.endDate}
            onChange={(event) => onChange({ ...item, endDate: event.target.value })}
            aria-invalid={Boolean(endDateError || dateRangeError)}
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
          />
          {endDateError && (
            <span className="mt-2 block text-sm text-red-300">{endDateError}</span>
          )}
        </label>

        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Quantity
          </span>
          <input
            type="number"
            min="1"
            step="1"
            value={item.quantity}
            onChange={(event) =>
              onChange({ ...item, quantity: Number(event.target.value) || 0 })
            }
            aria-invalid={Boolean(quantityError)}
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
          />
          {quantityError && (
            <span className="mt-2 block text-sm text-red-300">{quantityError}</span>
          )}
        </label>

        <label>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Daily rate
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.dailyRate}
            readOnly
            aria-invalid={Boolean(rateError)}
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none read-only:cursor-default read-only:opacity-80 focus:border-yellow-500/40"
          />
          {rateError && (
            <span className="mt-2 block text-sm text-red-300">{rateError}</span>
          )}
        </label>

        <label className="md:col-span-2">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Item notes
          </span>
          <textarea
            rows={3}
            value={item.notes}
            onChange={(event) => onChange({ ...item, notes: event.target.value })}
            placeholder="Attachments, schedule details, or equipment-specific notes"
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none placeholder:text-[#8f8577] focus:border-yellow-500/40"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-yellow-500/10 bg-[#f4b000]/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-[#b8a99a]">
          {pricing
            ? `${pricing.billableDays} billable day${
                pricing.billableDays === 1 ? "" : "s"
              }`
            : "Complete the schedule to calculate pricing"}
        </span>
        <strong className="text-xl text-[#fff7ed]">
          {pricing ? `$${pricing.lineTotal.toFixed(2)}` : "—"}
        </strong>
      </div>
    </article>
  );
}

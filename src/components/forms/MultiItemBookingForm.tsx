import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getBookableEquipment, getEquipmentDailyRate } from "../../data/equipmentSelectors";
import { DomainValidationError, type DomainValidationIssue } from "../../domain/errors/DomainValidationError";
import type {
  CustomerType,
  RentalRequestItemDraft,
  RentalRequestSubmission,
} from "../../domain/models/rentalRequestWorkflow";
import { validateRentalRequestSubmission } from "../../domain/validators/rentalRequestWorkflowValidators";
import { publicRentalRequestWorkflowService } from "../../services/multiItemRentalRequestService";
import RentalItemEditorList from "../rentalItems/RentalItemEditorList";
import RentalPricingSummary from "../rentalItems/RentalPricingSummary";
import RentalValidationSummary from "../rentalItems/RentalValidationSummary";
import BookingSuccess from "./BookingSuccess";

const equipmentOptions = getBookableEquipment();

const createClientId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createDraftItem = (
  equipmentId = "",
  dates?: Pick<RentalRequestItemDraft, "startDate" | "endDate">
): RentalRequestItemDraft => {
  const equipment = equipmentOptions.find((item) => item.id === equipmentId);

  return {
    clientId: createClientId(),
    equipmentId: equipment?.id ?? "",
    equipmentName: equipment?.name ?? "",
    startDate: dates?.startDate ?? "",
    endDate: dates?.endDate ?? "",
    quantity: 1,
    dailyRate: equipment ? getEquipmentDailyRate(equipment) : 0,
    serialNumber: null,
    notes: "",
  };
};

export default function MultiItemBookingForm() {
  const [searchParams] = useSearchParams();
  const initialEquipmentId = searchParams.get("equipment") ?? "";
  const [customerType, setCustomerType] = useState<CustomerType>("individual");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"Pickup" | "Delivery">(
    "Pickup"
  );
  const [projectType, setProjectType] = useState("");
  const [notes, setNotes] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [items, setItems] = useState<RentalRequestItemDraft[]>(() => [
    createDraftItem(initialEquipmentId),
  ]);
  const [issues, setIssues] = useState<DomainValidationIssue[]>([]);
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submission = useMemo<RentalRequestSubmission>(
    () => ({
      customerType,
      fullName,
      businessName,
      phone,
      email,
      fulfillmentType,
      projectType,
      notes,
      agreementAccepted,
      items,
    }),
    [
      agreementAccepted,
      businessName,
      customerType,
      email,
      fulfillmentType,
      fullName,
      items,
      notes,
      phone,
      projectType,
    ]
  );

  const updateItems = (updatedItems: RentalRequestItemDraft[]) => {
    setItems(updatedItems);
    setIssues([]);
    setSubmissionError("");
  };

  const addItem = () => {
    const previousItem = items.at(-1);
    updateItems([
      ...items,
      createDraftItem(
        "",
        previousItem
          ? { startDate: previousItem.startDate, endDate: previousItem.endDate }
          : undefined
      ),
    ]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validationIssues = validateRentalRequestSubmission(submission);
    setIssues(validationIssues);
    setSubmissionError("");

    if (validationIssues.length > 0) return;

    setIsSubmitting(true);

    try {
      await publicRentalRequestWorkflowService.createRequest(submission);
      setIsSubmitted(true);
    } catch (error) {
      if (error instanceof DomainValidationError) {
        setIssues([...error.issues]);
        setSubmissionError(error.message);
      } else {
        console.error("MULTI-ITEM BOOKING ERROR:", error);
        setSubmissionError("Unable to submit the request. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) return <BookingSuccess />;

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-5 shadow-2xl shadow-black/30 sm:p-8"
    >
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
          Customer
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {(["individual", "business"] as const).map((type) => (
            <label
              key={type}
              className="flex items-center gap-3 rounded-2xl border border-yellow-500/10 bg-black/25 px-5 py-4 text-[#fff7ed]"
            >
              <input
                type="radio"
                name="customerType"
                checked={customerType === type}
                onChange={() => setCustomerType(type)}
              />
              <span className="font-bold capitalize">{type}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <TextField label="Full name" value={fullName} onChange={setFullName} />
          {customerType === "business" && (
            <TextField
              label="Legal business name"
              value={businessName}
              onChange={setBusinessName}
            />
          )}
          <TextField label="Phone" type="tel" value={phone} onChange={setPhone} />
          <TextField label="Email" type="email" value={email} onChange={setEmail} />
        </div>
      </div>

      <div className="my-8 border-t border-yellow-500/10" />

      <RentalItemEditorList
        items={items}
        equipmentOptions={equipmentOptions}
        issues={issues}
        onItemsChange={updateItems}
        onAdd={addItem}
      />

      <div className="my-8 border-t border-yellow-500/10" />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
              Pickup or delivery
            </span>
            <select
              value={fulfillmentType}
              onChange={(event) =>
                setFulfillmentType(event.target.value as "Pickup" | "Delivery")
              }
              className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
            >
              <option value="Pickup">Pickup</option>
              <option value="Delivery">Delivery</option>
            </select>
          </label>

          <TextField
            label="Project type / reason for rental"
            value={projectType}
            onChange={setProjectType}
          />

          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
              Request notes
            </span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
            />
          </label>
        </div>

        <RentalPricingSummary items={items} />
      </div>

      <label className="mt-8 flex items-start gap-3 text-sm leading-6 text-[#b8a99a]">
        <input
          type="checkbox"
          checked={agreementAccepted}
          onChange={(event) => setAgreementAccepted(event.target.checked)}
          className="mt-1"
        />
        <span>
          I understand this is a rental request and availability, final price,
          payment, pickup, and delivery must be confirmed.
        </span>
      </label>

      <div className="mt-6 space-y-4">
        <RentalValidationSummary issues={issues} />
        {submissionError && (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-300">
            {submissionError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-8 w-full rounded-full bg-[#f4b000] px-8 py-5 text-lg font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting Request..." : "Submit Rental Request"}
      </button>
    </form>
  );
}

interface TextFieldProps {
  label: string;
  type?: "text" | "tel" | "email";
  value: string;
  onChange: (value: string) => void;
}

function TextField({ label, type = "text", value, onChange }: TextFieldProps) {
  return (
    <label>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
      />
    </label>
  );
}

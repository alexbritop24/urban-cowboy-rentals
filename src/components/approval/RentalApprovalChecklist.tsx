import { useEffect, useState } from "react";

import type {
  RentalApprovalCheckKey,
  RentalApprovalChecklist as RentalApprovalChecklistModel,
} from "../../domain/models/rentalApproval";
import {
  approveRentalRequest,
  confirmInitialRentalAvailability,
  loadRentalApprovalChecklist,
  reverseRentalApproval,
} from "../../services/rentalApprovalService";

interface RentalApprovalChecklistProps {
  rentalRequestId: string;
  onStateChange?: (state: RentalApprovalChecklistModel) => void;
}

const labels: Record<RentalApprovalCheckKey, string> = {
  item_data_complete: "Equipment and dates",
  initial_availability: "Equipment availability",
  driver_license: "Driver license uploaded",
  driver_license_verification: "Utah license reviewed",
  insurance: "Insurance uploaded",
  insurance_verification: "Insurance reviewed",
  card_authorization: "Card authorization",
  acceptance: "Customer agreement",
  agreement_final: "Agreement finalized",
  payment_requirement: "Payment setup",
  final_availability: "Final availability check",
};

// Preserve unknown server messages so new or unexpected conditions stay visible.
const plainReasons: Record<string, string> = {
  "Authoritative item data is complete.": "Equipment, dates, and quantity are complete.",
  "Equipment items require valid resource identity, dates, and quantity.": "Check the equipment, rental dates, and quantity.",
  "Initial availability has not been confirmed.": "Check that the equipment is available for these dates.",
  "Initial availability confirmation is stale.": "The rental details changed. Check availability again.",
  "The latest initial availability check found a conflict.": "The equipment conflicts with another rental. Review the dates.",
  "Initial availability matches the current schedule.": "The equipment was available when last checked.",
  "A current driver license is required before Utah verification.": "Upload the customer's current license before reviewing it.",
  "The current driver license is manually verified as Utah-issued.": "The uploaded license was reviewed and verified as Utah-issued.",
  "The current driver license requires a new Utah verification review.": "Review the current license again.",
  "The current driver license was rejected.": "The uploaded license was rejected.",
  "Agreement credit-card authorization is required.": "Record the customer's actual card authorization in the agreement.",
  "Credit-card authorization was acknowledged in the Agreement.": "The customer's card authorization is recorded in the agreement.",
  "Customer acceptance evidence must match the Agreement snapshot.": "Record the customer's actual acceptance of this version of the agreement.",
  "Customer acceptance matches the Agreement snapshot.": "The customer's acceptance is recorded for this version of the agreement.",
  "The immutable Agreement is finalized.": "The agreement has been finalized and locked.",
  "Payment requirement has not been configured.": "The payment rule is not set up yet. Contact the administrator.",
  "Final availability is checked transactionally during approval.": "The system checks availability again when you approve the rental.",
  "Final availability was revalidated in the approval transaction.": "Availability was checked again when the rental was approved.",
  "The latest final availability revalidation found a conflict.": "The final check found a scheduling conflict.",
  "Approval was reversed; reapproval requires a new final check.": "Approval was reversed. Availability will be checked again before reapproval.",
};

const stateStyle = {
  pass: "border-green-500/25 bg-green-500/10 text-green-300",
  fail: "border-red-500/25 bg-red-500/10 text-red-300",
  pending: "border-yellow-500/20 bg-black/30 text-[#b8a99a]",
  stale: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  configuration_required: "border-purple-500/25 bg-purple-500/10 text-purple-300",
} as const;

const stateSymbol = {
  pass: "✓",
  fail: "×",
  pending: "○",
  stale: "↻",
  configuration_required: "!",
} as const;

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : "The Approval workflow could not complete the action.";

export default function RentalApprovalChecklist({
  rentalRequestId,
  onStateChange,
}: RentalApprovalChecklistProps) {
  const [checklist, setChecklist] = useState<RentalApprovalChecklistModel | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"initial" | "approve" | "reverse" | null>(null);
  const [notice, setNotice] = useState("");

  const applyChecklist = (
    next: RentalApprovalChecklistModel,
    notifyParent = true
  ) => {
    setChecklist(next);
    if (notifyParent) onStateChange?.(next);
  };

  useEffect(() => {
    let active = true;
    loadRentalApprovalChecklist(rentalRequestId)
      .then((next) => {
        if (active) applyChecklist(next, false);
      })
      .catch((error) => {
        if (active) setNotice(errorMessage(error));
      });
    return () => {
      active = false;
    };
    // The callback is notification-only and does not own loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalRequestId]);

  const run = async (action: "initial" | "approve" | "reverse") => {
    setBusy(action);
    setNotice("");
    try {
      const result = action === "initial"
        ? await confirmInitialRentalAvailability(rentalRequestId, note)
        : action === "approve"
          ? await approveRentalRequest(rentalRequestId, note)
          : await reverseRentalApproval(rentalRequestId, note);
      applyChecklist(result.checklist);
      setNotice(result.message);
      if (result.succeeded) setNote("");
    } catch (error) {
      setNotice(errorMessage(error));
      applyChecklist(await loadRentalApprovalChecklist(rentalRequestId));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
            Approval Checklist
          </p>
          <p className="mt-2 text-sm text-[#b8a99a]">
            Complete the required steps before approving this rental. Availability is checked again when you approve.
          </p>
        </div>
        <span className="rounded-full border border-yellow-500/20 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#fff7ed]">
          {checklist?.approvalState === "legacy_unverified"
            ? "Older record — approval not verified"
            : checklist?.approvalState.replaceAll("_", " ") ?? "Loading"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {checklist?.checks.map((check) => (
          <div
            key={check.key}
            className={`rounded-2xl border p-4 ${stateStyle[check.state]}`}
          >
            <p className="font-black">
              <span className="mr-2" aria-hidden="true">{stateSymbol[check.state]}</span>
              {labels[check.key]}
            </p>
            <p className="mt-1 text-xs opacity-85">{plainReasons[check.reason] ?? check.reason}</p>
          </div>
        ))}
      </div>

      <label className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
        Approval note
        <textarea
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note about this approval"
          className="mt-2 w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 normal-case tracking-normal text-[#fff7ed] outline-none focus:border-yellow-500/40"
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy !== null || !checklist?.actions.canConfirmInitial}
          onClick={() => void run("initial")}
          className="rounded-full border border-yellow-500/30 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "initial" ? "Checking..." : "Check Availability"}
        </button>
        <button
          type="button"
          disabled={busy !== null || !checklist?.actions.canApprove}
          onClick={() => void run("approve")}
          className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-green-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "approve" ? "Approving..." : "Approve Rental"}
        </button>
        <button
          type="button"
          disabled={busy !== null || !checklist?.actions.canReverse}
          onClick={() => void run("reverse")}
          className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "reverse" ? "Reversing..." : "Reverse Approval"}
        </button>
      </div>

      {notice && (
        <p className="mt-4 rounded-2xl border border-yellow-500/15 bg-black/30 px-4 py-3 text-sm text-[#fff7ed]">
          {notice}
        </p>
      )}
    </section>
  );
}

export const rentalApprovalCheckKeys = [
  "item_data_complete",
  "initial_availability",
  "driver_license",
  "driver_license_verification",
  "insurance",
  "insurance_verification",
  "card_authorization",
  "acceptance",
  "agreement_final",
  "payment_requirement",
  "final_availability",
] as const;

export type RentalApprovalCheckKey = (typeof rentalApprovalCheckKeys)[number];
export type RentalApprovalCheckState =
  | "pass"
  | "fail"
  | "pending"
  | "stale"
  | "configuration_required";
export type RentalApprovalState =
  | "pending"
  | "approved"
  | "reversed"
  | "legacy_unverified";
export type RentalApprovalPaymentPolicy =
  | "unconfigured"
  | "deposit_required"
  | "invoice_paid";

export interface RentalApprovalCheck {
  key: RentalApprovalCheckKey;
  state: RentalApprovalCheckState;
  reason: string;
}

export interface RentalApprovalActions {
  canConfirmInitial: boolean;
  canApprove: boolean;
  canReverse: boolean;
}

export interface RentalApprovalChecklist {
  rentalRequestId: string;
  approvalState: RentalApprovalState;
  approvedBy: string | null;
  approvedAt: string | null;
  reversedBy: string | null;
  reversedAt: string | null;
  reversalNote: string | null;
  scheduleHash: string | null;
  paymentPolicy: RentalApprovalPaymentPolicy;
  checks: readonly RentalApprovalCheck[];
  actions: RentalApprovalActions;
}

export interface RentalApprovalActionResult {
  succeeded: boolean;
  code: string;
  message: string;
  approvalEventId: string | null;
  checklist: RentalApprovalChecklist;
}

export interface RentalApprovalCommand {
  rentalRequestId: string;
  note: string | null;
}

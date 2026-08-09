import type { SupabaseClient } from "@supabase/supabase-js";

import {
  rentalApprovalCheckKeys,
  type RentalApprovalActionResult,
  type RentalApprovalActions,
  type RentalApprovalCheck,
  type RentalApprovalChecklist,
  type RentalApprovalCheckState,
  type RentalApprovalCommand,
  type RentalApprovalPaymentPolicy,
  type RentalApprovalState,
} from "../models/rentalApproval";
import type { RentalApprovalRepository } from "../models/rentalApprovalRepository";
import type { Database, Json } from "../../types/database.generated";

type ChecklistArgs =
  Database["public"]["Functions"]["get_rental_approval_checklist"]["Args"];
type InitialAvailabilityArgs =
  Database["public"]["Functions"]["confirm_rental_request_initial_availability"]["Args"];
type ApproveArgs =
  Database["public"]["Functions"]["approve_rental_request"]["Args"];
type ReverseArgs =
  Database["public"]["Functions"]["reverse_rental_approval"]["Args"];
type JsonObject = Record<string, Json | undefined>;

const asObject = (value: unknown, label: string): JsonObject => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  throw new Error(`${label} response was invalid.`);
};

const stringValue = (value: Json | undefined): string =>
  typeof value === "string" ? value : "";
const nullableString = (value: Json | undefined): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const booleanValue = (value: Json | undefined): boolean => value === true;

const checkStates = new Set<RentalApprovalCheckState>([
  "pass",
  "fail",
  "pending",
  "stale",
  "configuration_required",
]);
const approvalStates = new Set<RentalApprovalState>([
  "pending",
  "approved",
  "reversed",
  "legacy_unverified",
]);
const paymentPolicies = new Set<RentalApprovalPaymentPolicy>([
  "unconfigured",
  "deposit_required",
  "invoice_paid",
]);

const mapChecklist = (value: unknown): RentalApprovalChecklist => {
  const row = asObject(value, "Approval checklist");
  const rawChecks = asObject(row.checks, "Approval checks");
  const rawActions = asObject(row.actions, "Approval actions");
  const checks: RentalApprovalCheck[] = rentalApprovalCheckKeys.map((key) => {
    const check = asObject(rawChecks[key], `Approval check ${key}`);
    const state = stringValue(check.state) as RentalApprovalCheckState;
    if (!checkStates.has(state)) {
      throw new Error(`Approval check ${key} returned an unsupported state.`);
    }
    return { key, state, reason: stringValue(check.reason) };
  });
  const approvalState = stringValue(row.approvalState) as RentalApprovalState;
  const paymentPolicy = stringValue(
    row.paymentPolicy
  ) as RentalApprovalPaymentPolicy;
  if (!approvalStates.has(approvalState) || !paymentPolicies.has(paymentPolicy)) {
    throw new Error("Approval checklist returned unsupported workflow metadata.");
  }

  const actions: RentalApprovalActions = {
    canConfirmInitial: booleanValue(rawActions.canConfirmInitial),
    canApprove: booleanValue(rawActions.canApprove),
    canReverse: booleanValue(rawActions.canReverse),
  };
  return {
    rentalRequestId: stringValue(row.rentalRequestId),
    approvalState,
    approvedBy: nullableString(row.approvedBy),
    approvedAt: nullableString(row.approvedAt),
    reversedBy: nullableString(row.reversedBy),
    reversedAt: nullableString(row.reversedAt),
    reversalNote: nullableString(row.reversalNote),
    scheduleHash: nullableString(row.scheduleHash),
    paymentPolicy,
    checks,
    actions,
  };
};

const mapAction = (value: unknown, successField: "approved" | "reversed" | "confirmed") => {
  const row = asObject(value, "Approval action");
  return {
    succeeded: booleanValue(row[successField]),
    code: stringValue(row.code),
    message: stringValue(row.message),
    approvalEventId: nullableString(row.approvalEventId),
    checklist: mapChecklist(row.checklist),
  } satisfies RentalApprovalActionResult;
};

const rpcCommandArgs = (command: RentalApprovalCommand) => ({
  target_rental_request_id: command.rentalRequestId,
  note_value: command.note,
});

export const createSupabaseRentalApprovalRepository = (
  client: SupabaseClient
): RentalApprovalRepository => ({
  async loadChecklist(rentalRequestId) {
    const args = { target_rental_request_id: rentalRequestId } satisfies ChecklistArgs;
    const { data, error } = await client.rpc("get_rental_approval_checklist", args);
    if (error) throw error;
    return mapChecklist(data);
  },

  async confirmInitialAvailability(command) {
    const args = rpcCommandArgs(command) satisfies InitialAvailabilityArgs;
    const { data, error } = await client.rpc(
      "confirm_rental_request_initial_availability",
      args
    );
    if (error) throw error;
    return mapAction(data, "confirmed");
  },

  async approve(command) {
    const args = rpcCommandArgs(command) satisfies ApproveArgs;
    const { data, error } = await client.rpc("approve_rental_request", args);
    if (error) throw error;
    return mapAction(data, "approved");
  },

  async reverse(command) {
    const args = rpcCommandArgs(command) satisfies ReverseArgs;
    const { data, error } = await client.rpc("reverse_rental_approval", args);
    if (error) throw error;
    return mapAction(data, "reversed");
  },
});

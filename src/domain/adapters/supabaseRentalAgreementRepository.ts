import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgreementItem } from "../models/agreementItem";
import type {
  AgreementAvailabilityStatus,
  AgreementClauseSnapshot,
  AgreementCustomerType,
  AgreementSignatureStatus,
  AgreementVerificationStatus,
  RentalAgreementAggregate,
  RentalAgreementSnapshot,
  RentalAgreementStatus,
} from "../models/rentalAgreement";
import type { RentalAgreementRepository } from "../models/rentalAgreementRepository";
import type { Database } from "../../types/database.generated";

type DatabaseRow = Record<string, unknown>;
type CreateAgreementArgs =
  Database["public"]["Functions"]["create_rental_agreement_for_request"]["Args"];
type UpdateFinancialsArgs =
  Database["public"]["Functions"]["update_rental_agreement_financials"]["Args"];
type RecordAcceptanceArgs =
  Database["public"]["Functions"]["record_rental_agreement_acceptance"]["Args"];
type FinalizeAgreementArgs =
  Database["public"]["Functions"]["finalize_rental_agreement"]["Args"];

const requiredString = (row: DatabaseRow, field: string): string =>
  typeof row[field] === "string" ? row[field] : "";

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const numberValue = (row: DatabaseRow, field: string): number => {
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : 0;
};

const booleanValue = (row: DatabaseRow, field: string): boolean =>
  row[field] === true;

const mapClauseSnapshot = (value: unknown): AgreementClauseSnapshot[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as DatabaseRow;
    return [
      {
        id: requiredString(row, "id"),
        title: requiredString(row, "title"),
        body: requiredString(row, "body"),
        displayOrder: numberValue(row, "display_order"),
        enabled: row.enabled !== false,
        category: requiredString(row, "category") || "general",
        equipmentCategory: nullableString(row.equipment_category),
        stateCode: requiredString(row, "state_code") || "UT",
        version: numberValue(row, "version"),
        createdAt: requiredString(row, "created_at"),
        updatedAt: requiredString(row, "updated_at"),
      },
    ];
  });
};

const mapAgreement = (row: DatabaseRow): RentalAgreementSnapshot => {
  const clauseSnapshot = mapClauseSnapshot(row.clause_snapshot);
  const termsVersion = nullableString(row.terms_version);
  const clauseSnapshotCreatedAt = nullableString(row.clause_snapshot_created_at);
  const snapshotSchemaVersion = row.snapshot_schema_version === 1 ? 1 : null;
  const currentSnapshotHash = nullableString(row.current_snapshot_hash);
  const creditCardAuthorizationTerms = nullableString(
    row.credit_card_authorization_terms
  );
  const snapshotAvailability =
    snapshotSchemaVersion === 1 &&
    currentSnapshotHash &&
    termsVersion &&
    clauseSnapshotCreatedAt &&
    creditCardAuthorizationTerms &&
    clauseSnapshot.length > 0
      ? {
          status: "verified" as const,
          schemaVersion: snapshotSchemaVersion,
          currentHash: currentSnapshotHash,
        }
      : {
          status: "missing" as const,
          reason:
            "An immutable legal Agreement snapshot is unavailable for this legacy record.",
        };

  return {
  id: requiredString(row, "id"),
  rentalRequestId: requiredString(row, "rental_request_id"),
  agreementNumber: requiredString(row, "agreement_number"),
  status: requiredString(row, "status") as RentalAgreementStatus,
  customerType: requiredString(row, "customer_type") as AgreementCustomerType,
  customerName: requiredString(row, "customer_name"),
  businessName: nullableString(row.business_name),
  customerEmail: requiredString(row, "customer_email"),
  customerPhone: requiredString(row, "customer_phone"),
  billingAddress: nullableString(row.billing_address),
  serviceAddress: nullableString(row.service_address),
  equipmentRequested: requiredString(row, "equipment_requested"),
  rentalStartDate: nullableString(row.rental_start_date),
  rentalEndDate: nullableString(row.rental_end_date),
  rentalDuration: nullableString(row.rental_duration),
  fulfillmentType: nullableString(row.fulfillment_type),
  quoteAmount: numberValue(row, "quote_amount"),
  depositAmount: numberValue(row, "deposit_amount"),
  deliveryFee: numberValue(row, "delivery_fee"),
  taxAmount: numberValue(row, "tax_amount"),
  totalAmount: numberValue(row, "total_amount"),
  agreementHtml: nullableString(row.agreement_html),
  signedPdfUrl: nullableString(row.signed_pdf_url),
  effectiveAt: requiredString(row, "effective_at"),
  signatureStatus: requiredString(row, "signature_status") as AgreementSignatureStatus,
  acceptanceAcknowledged: booleanValue(row, "acceptance_acknowledged"),
  authorizedSignerName: nullableString(row.authorized_signer_name),
  authorizedSignerTitle: nullableString(row.authorized_signer_title),
  acceptedTermsVersion: nullableString(row.accepted_terms_version),
  creditCardAuthorizationAcknowledged: booleanValue(
    row,
    "credit_card_authorization_acknowledged"
  ),
  creditCardAuthorizationAcknowledgedAt: nullableString(
    row.credit_card_authorization_acknowledged_at
  ),
  insuranceVerificationStatus: requiredString(
    row,
    "insurance_verification_status"
  ) as AgreementVerificationStatus,
  availabilityConfirmationStatus: requiredString(
    row,
    "availability_confirmation_status"
  ) as AgreementAvailabilityStatus,
  termsVersion,
  clauseSnapshot,
  clauseSnapshotCreatedAt,
  snapshotSchemaVersion,
  currentSnapshotHash,
  acceptedSnapshotHash: nullableString(row.accepted_snapshot_hash),
  creditCardAuthorizationTerms,
  snapshotAvailability,
  sentAt: nullableString(row.sent_at),
  viewedAt: nullableString(row.viewed_at),
  signedAt: nullableString(row.signed_at),
  signedBy: nullableString(row.signed_by),
  lockedAt: nullableString(row.locked_at),
  createdAt: requiredString(row, "created_at"),
  updatedAt: requiredString(row, "updated_at"),
  };
};

const mapItem = (row: DatabaseRow): AgreementItem => ({
  id: requiredString(row, "id"),
  rentalAgreementId: requiredString(row, "rental_agreement_id"),
  rentalRequestItemId: nullableString(row.rental_request_item_id),
  displayOrder: numberValue(row, "display_order"),
  equipmentId: nullableString(row.equipment_id),
  equipmentName: requiredString(row, "equipment_name"),
  serialNumber: nullableString(row.serial_number),
  startDate: requiredString(row, "start_date"),
  endDate: requiredString(row, "end_date"),
  quantity: numberValue(row, "quantity"),
  dailyRate: numberValue(row, "daily_rate"),
  billableDays: numberValue(row, "billable_days"),
  lineTotal: numberValue(row, "line_total"),
  notes: nullableString(row.notes),
  origin: row.rental_request_item_id ? "normalized" : "legacy",
  createdAt: nullableString(row.created_at),
});

const readRpcId = (value: unknown): string => {
  if (typeof value === "string" && value) return value;
  throw new Error("The Agreement operation did not return an identifier.");
};

const loadAggregate = async (
  client: SupabaseClient,
  filter: { field: "id" | "rental_request_id"; value: string }
): Promise<RentalAgreementAggregate | null> => {
  const { data: agreementData, error: agreementError } = await client
    .from("rental_agreements")
    .select("*")
    .eq(filter.field, filter.value)
    .maybeSingle();

  if (agreementError) throw agreementError;
  if (!agreementData) return null;

  const agreementRow = agreementData as DatabaseRow;
  const agreementId = requiredString(agreementRow, "id");
  const { data: itemData, error: itemError } = await client
    .from("agreement_items")
    .select("*")
    .eq("rental_agreement_id", agreementId)
    .order("display_order", { ascending: true });

  if (itemError) throw itemError;

  return {
    agreement: mapAgreement(agreementRow),
    items: Array.isArray(itemData)
      ? (itemData as DatabaseRow[]).map(mapItem)
      : [],
  };
};

export const createSupabaseRentalAgreementRepository = (
  client: SupabaseClient
): RentalAgreementRepository => ({
  findById: (agreementId) =>
    loadAggregate(client, { field: "id", value: agreementId }),

  findByRentalRequestId: (rentalRequestId) =>
    loadAggregate(client, {
      field: "rental_request_id",
      value: rentalRequestId,
    }),

  async createForRentalRequest(rentalRequestId) {
    const args = {
      target_rental_request_id: rentalRequestId,
    } satisfies CreateAgreementArgs;
    const { data, error } = await client.rpc(
      "create_rental_agreement_for_request",
      args
    );
    if (error) throw error;
    return readRpcId(data);
  },

  async updateFinancials(command) {
    const args = {
      target_agreement_id: command.agreementId,
      deposit_amount_value: command.depositAmount,
      delivery_fee_value: command.deliveryFee,
      tax_amount_value: command.taxAmount,
    } satisfies UpdateFinancialsArgs;
    const { data, error } = await client.rpc(
      "update_rental_agreement_financials",
      args
    );
    if (error) throw error;
    return readRpcId(data);
  },

  async recordAcceptance(command) {
    const args = {
      target_agreement_id: command.agreementId,
      signer_legal_name: command.signerLegalName,
      signer_title: command.signerTitle,
      agreement_accepted: command.agreementAccepted,
      card_authorization_acknowledged:
        command.creditCardAuthorizationAcknowledged,
    } satisfies RecordAcceptanceArgs;
    const { data, error } = await client.rpc(
      "record_rental_agreement_acceptance",
      args
    );
    if (error) throw error;
    return readRpcId(data);
  },

  async finalize(agreementId) {
    const args = {
      target_agreement_id: agreementId,
    } satisfies FinalizeAgreementArgs;
    const { data, error } = await client.rpc("finalize_rental_agreement", args);
    if (error) throw error;
    return readRpcId(data);
  },
});

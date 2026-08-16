import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DriverLicenseReview,
  DriverLicenseVerificationStatus,
  InsuranceVerificationStatus,
  RentalDocumentMetadata,
  RentalDocumentWorkflowCapabilities,
  RentalDocumentWorkflowState,
} from "../models/rentalDocument";
import type { RentalDocumentRepository } from "../models/rentalDocumentRepository";
import type { Database } from "../../types/database.generated";

type DatabaseRow = Record<string, unknown>;
type RegisterDocumentArgs =
  Database["public"]["Functions"]["register_rental_document"]["Args"];
type ReviewInsuranceArgs =
  Database["public"]["Functions"]["review_rental_insurance"]["Args"];
type ReviewDriverLicenseArgs =
  Database["public"]["Functions"]["review_rental_driver_license"]["Args"];
type WorkflowCapabilitiesArgs =
  Database["public"]["Functions"]["get_rental_document_workflow_capabilities"]["Args"];

const requiredString = (row: DatabaseRow, field: string): string =>
  typeof row[field] === "string" ? row[field] : "";

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const requiredBoolean = (row: DatabaseRow, field: string): boolean => {
  if (typeof row[field] !== "boolean") {
    throw new Error(`Rental document capability ${field} was invalid.`);
  }
  return row[field];
};

const mapCapabilities = (value: unknown): RentalDocumentWorkflowCapabilities => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Rental document workflow capabilities were invalid.");
  }
  const row = value as DatabaseRow;
  const approvalStatus = requiredString(row, "approvalStatus");
  if (!(["pending", "approved", "reversed"] as const).includes(
    approvalStatus as "pending" | "approved" | "reversed"
  )) {
    throw new Error("Rental document approval status was invalid.");
  }
  return {
    agreementFinalized: requiredBoolean(row, "agreementFinalized"),
    approvalStatus: approvalStatus as RentalDocumentWorkflowCapabilities["approvalStatus"],
    canUploadOrReplaceDocuments: requiredBoolean(
      row,
      "canUploadOrReplaceDocuments"
    ),
    canReviewInsurance: requiredBoolean(row, "canReviewInsurance"),
    canVerifyDriverLicense: requiredBoolean(row, "canVerifyDriverLicense"),
    canRejectDriverLicense: requiredBoolean(row, "canRejectDriverLicense"),
    driverLicenseReviewReason: nullableString(row.driverLicenseReviewReason),
  };
};

const mapDocument = (row: DatabaseRow): RentalDocumentMetadata => ({
  id: requiredString(row, "id"),
  rentalRequestId: requiredString(row, "rental_request_id"),
  documentType: requiredString(row, "document_type") as RentalDocumentMetadata["documentType"],
  originalFilename: requiredString(row, "original_filename"),
  mimeType: requiredString(row, "mime_type"),
  sizeBytes: Number(row.size_bytes) || 0,
  uploadedBy: requiredString(row, "uploaded_by"),
  uploadedAt: requiredString(row, "uploaded_at"),
  isCurrent: row.is_current === true,
  replacesDocumentId: nullableString(row.replaces_document_id),
  replacedByDocumentId: nullableString(row.replaced_by_document_id),
  replacedAt: nullableString(row.replaced_at),
  replacedBy: nullableString(row.replaced_by),
  createdAt: requiredString(row, "created_at"),
});

const mapDriverLicenseReview = (row: DatabaseRow): DriverLicenseReview => ({
  id: requiredString(row, "id"),
  rentalRequestId: requiredString(row, "rental_request_id"),
  driverLicenseDocumentId: requiredString(row, "driver_license_document_id"),
  status: requiredString(row, "review_status") as DriverLicenseReview["status"],
  issuingState: requiredString(row, "issuing_state"),
  reviewedBy: requiredString(row, "reviewed_by"),
  reviewedAt: requiredString(row, "reviewed_at"),
  note: nullableString(row.review_note),
});

const assertFile = (source: unknown): File => {
  if (!(source instanceof File)) {
    throw new Error("A browser File is required for document upload.");
  }
  return source;
};

export const createSupabaseRentalDocumentRepository = (
  client: SupabaseClient
): RentalDocumentRepository => ({
  async loadWorkflowState(rentalRequestId) {
    const [
      { data: documentData, error: documentError },
      { data: requestData, error: requestError },
      { data: reviewData, error: reviewError },
      { data: capabilityData, error: capabilityError },
    ] =
      await Promise.all([
        client
          .from("rental_documents")
          .select(
            "id,rental_request_id,document_type,original_filename,mime_type,size_bytes,uploaded_by,uploaded_at,is_current,replaces_document_id,replaced_by_document_id,replaced_at,replaced_by,created_at"
          )
          .eq("rental_request_id", rentalRequestId)
          .order("uploaded_at", { ascending: false }),
        client
          .from("rental_requests")
          .select(
            "id,driver_license_verification_status,driver_license_reviewed_document_id,driver_license_issuing_state,driver_license_reviewed_by,driver_license_reviewed_at,driver_license_review_note,insurance_verification_status,insurance_reviewed_document_id,insurance_reviewed_by,insurance_reviewed_at,insurance_review_note"
          )
          .eq("id", rentalRequestId)
          .single(),
        client
          .from("rental_driver_license_reviews")
          .select(
            "id,rental_request_id,driver_license_document_id,review_status,issuing_state,reviewed_by,reviewed_at,review_note"
          )
          .eq("rental_request_id", rentalRequestId)
          .order("reviewed_at", { ascending: false }),
        client.rpc("get_rental_document_workflow_capabilities", {
          target_rental_request_id: rentalRequestId,
        } satisfies WorkflowCapabilitiesArgs),
      ]);

    if (documentError) throw documentError;
    if (requestError) throw requestError;
    if (reviewError) throw reviewError;
    if (capabilityError) throw capabilityError;

    const request = requestData as DatabaseRow;
    return {
      rentalRequestId,
      capabilities: mapCapabilities(capabilityData),
      documents: Array.isArray(documentData)
        ? (documentData as DatabaseRow[]).map(mapDocument)
        : [],
      driverLicenseVerificationStatus: requiredString(
        request,
        "driver_license_verification_status"
      ) as DriverLicenseVerificationStatus,
      driverLicenseReviewedDocumentId: nullableString(
        request.driver_license_reviewed_document_id
      ),
      driverLicenseIssuingState: nullableString(request.driver_license_issuing_state),
      driverLicenseReviewedBy: nullableString(request.driver_license_reviewed_by),
      driverLicenseReviewedAt: nullableString(request.driver_license_reviewed_at),
      driverLicenseReviewNote: nullableString(request.driver_license_review_note),
      driverLicenseReviewHistory: Array.isArray(reviewData)
        ? (reviewData as DatabaseRow[]).map(mapDriverLicenseReview)
        : [],
      insuranceVerificationStatus: requiredString(
        request,
        "insurance_verification_status"
      ) as InsuranceVerificationStatus,
      insuranceReviewedDocumentId: nullableString(
        request.insurance_reviewed_document_id
      ),
      insuranceReviewedBy: nullableString(request.insurance_reviewed_by),
      insuranceReviewedAt: nullableString(request.insurance_reviewed_at),
      insuranceReviewNote: nullableString(request.insurance_review_note),
    } satisfies RentalDocumentWorkflowState;
  },

  async upload(command) {
    const file = assertFile(command.file.source);
    const formData = new FormData();
    formData.set("action", "upload");
    formData.set("rentalRequestId", command.rentalRequestId);
    formData.set("documentType", command.documentType);
    formData.set("file", file, command.file.name);

    const { error } = await client.functions.invoke("rental-documents", {
      body: formData,
    });
    if (error) throw error;
  },

  async createSignedViewUrl(documentId) {
    const { data, error } = await client.functions.invoke("rental-documents", {
      body: { action: "signed_url", documentId },
    });
    if (error) throw error;
    if (!data || typeof data.signedUrl !== "string") {
      throw new Error("The signed document URL response was invalid.");
    }
    return data.signedUrl;
  },

  async reviewDriverLicense(command) {
    const args = {
      target_rental_request_id: command.rentalRequestId,
      expected_driver_license_document_id:
        command.expectedDriverLicenseDocumentId,
      verification_status_value: command.status,
      issuing_state_value: command.issuingState,
      review_note_value: command.note,
    } satisfies ReviewDriverLicenseArgs;
    const { error } = await client.rpc("review_rental_driver_license", args);
    if (error) throw error;
  },

  async reviewInsurance(command) {
    const args = {
      target_rental_request_id: command.rentalRequestId,
      verification_status_value: command.status,
      review_note_value: command.note,
    } satisfies ReviewInsuranceArgs;
    const { error } = await client.rpc("review_rental_insurance", args);
    if (error) throw error;
  },
});

// This compile-time-only contract keeps the generated RPC signature aligned
// with the trusted Edge Function's metadata registration call.
export type RentalDocumentRegistrationRpcArgs = RegisterDocumentArgs;

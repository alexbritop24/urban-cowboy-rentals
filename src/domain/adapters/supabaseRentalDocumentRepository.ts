import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  InsuranceVerificationStatus,
  RentalDocumentMetadata,
  RentalDocumentWorkflowState,
} from "../models/rentalDocument";
import type { RentalDocumentRepository } from "../models/rentalDocumentRepository";
import type { Database } from "../../types/database.generated";

type DatabaseRow = Record<string, unknown>;
type RegisterDocumentArgs =
  Database["public"]["Functions"]["register_rental_document"]["Args"];
type ReviewInsuranceArgs =
  Database["public"]["Functions"]["review_rental_insurance"]["Args"];

const requiredString = (row: DatabaseRow, field: string): string =>
  typeof row[field] === "string" ? row[field] : "";

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

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
    const [{ data: documentData, error: documentError }, { data: requestData, error: requestError }] =
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
            "id,insurance_verification_status,insurance_reviewed_document_id,insurance_reviewed_by,insurance_reviewed_at,insurance_review_note"
          )
          .eq("id", rentalRequestId)
          .single(),
      ]);

    if (documentError) throw documentError;
    if (requestError) throw requestError;

    const request = requestData as DatabaseRow;
    return {
      rentalRequestId,
      documents: Array.isArray(documentData)
        ? (documentData as DatabaseRow[]).map(mapDocument)
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

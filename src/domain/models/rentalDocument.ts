export type RentalDocumentType = "driver_license" | "insurance";
export type InsuranceVerificationStatus = "pending" | "verified" | "rejected";

export interface RentalDocumentMetadata {
  id: string;
  rentalRequestId: string;
  documentType: RentalDocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  isCurrent: boolean;
  replacesDocumentId: string | null;
  replacedByDocumentId: string | null;
  replacedAt: string | null;
  replacedBy: string | null;
  createdAt: string;
}

export interface RentalDocumentWorkflowState {
  rentalRequestId: string;
  documents: readonly RentalDocumentMetadata[];
  insuranceVerificationStatus: InsuranceVerificationStatus;
  insuranceReviewedDocumentId: string | null;
  insuranceReviewedBy: string | null;
  insuranceReviewedAt: string | null;
  insuranceReviewNote: string | null;
}

export interface RentalDocumentFile {
  name: string;
  type: string;
  size: number;
  readSignature(): Promise<Uint8Array>;
  source: unknown;
}

export interface UploadRentalDocumentCommand {
  rentalRequestId: string;
  documentType: RentalDocumentType;
  file: RentalDocumentFile;
}

export interface ReviewRentalInsuranceCommand {
  rentalRequestId: string;
  status: Exclude<InsuranceVerificationStatus, "pending">;
  note: string | null;
}

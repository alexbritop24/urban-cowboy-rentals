import type { AgreementItem } from "./agreementItem";

export type RentalAgreementStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "ready"
  | "signed"
  | "cancelled";

export type AgreementCustomerType = "individual" | "business";
export type AgreementSignatureStatus = "pending" | "accepted" | "signed";
export type AgreementVerificationStatus =
  | "pending"
  | "verified"
  | "rejected";
export type AgreementAvailabilityStatus =
  | "pending_review"
  | "available"
  | "approved"
  | "conflict"
  | "unavailable";

export interface AgreementClauseSnapshot {
  id: string;
  title: string;
  body: string;
  displayOrder: number;
  enabled: boolean;
  category: string;
  equipmentCategory: string | null;
  stateCode: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RentalAgreementSnapshot {
  id: string;
  rentalRequestId: string;
  agreementNumber: string;
  status: RentalAgreementStatus;
  customerType: AgreementCustomerType;
  customerName: string;
  businessName: string | null;
  customerEmail: string;
  customerPhone: string;
  billingAddress: string | null;
  serviceAddress: string | null;
  equipmentRequested: string;
  rentalStartDate: string | null;
  rentalEndDate: string | null;
  rentalDuration: string | null;
  fulfillmentType: string | null;
  quoteAmount: number;
  depositAmount: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  agreementHtml: string | null;
  signedPdfUrl: string | null;
  effectiveAt: string;
  signatureStatus: AgreementSignatureStatus;
  acceptanceAcknowledged: boolean;
  authorizedSignerName: string | null;
  authorizedSignerTitle: string | null;
  acceptedTermsVersion: string | null;
  creditCardAuthorizationAcknowledged: boolean;
  creditCardAuthorizationAcknowledgedAt: string | null;
  insuranceVerificationStatus: AgreementVerificationStatus;
  availabilityConfirmationStatus: AgreementAvailabilityStatus;
  termsVersion: string;
  clauseSnapshot: readonly AgreementClauseSnapshot[];
  clauseSnapshotCreatedAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  signedBy: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentalAgreementAggregate {
  agreement: RentalAgreementSnapshot;
  items: readonly AgreementItem[];
}

export interface AgreementFinancialsCommand {
  agreementId: string;
  depositAmount: number;
  deliveryFee: number;
  taxAmount: number;
}

export interface AgreementAcceptanceCommand {
  agreementId: string;
  signerLegalName: string;
  signerTitle: string | null;
  agreementAccepted: boolean;
  creditCardAuthorizationAcknowledged: boolean;
}

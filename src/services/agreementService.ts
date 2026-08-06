import { createSupabaseRentalAgreementRepository } from "../domain/adapters/supabaseRentalAgreementRepository";
import type {
  AgreementAcceptanceCommand,
  RentalAgreementAggregate,
} from "../domain/models/rentalAgreement";
import { createRentalAgreementWorkflowService } from "../domain/services/rentalAgreementWorkflowService";
import { supabase } from "../lib/supabase";
import type { RentalAgreement } from "../types/agreement";
import type { AgreementClause } from "../types/agreementClause";

const workflow = createRentalAgreementWorkflowService(
  createSupabaseRentalAgreementRepository(supabase)
);

const mapClause = (
  clause: RentalAgreementAggregate["agreement"]["clauseSnapshot"][number]
): AgreementClause => ({
  id: clause.id,
  title: clause.title,
  body: clause.body,
  display_order: clause.displayOrder,
  enabled: clause.enabled,
  category: clause.category,
  equipment_category: clause.equipmentCategory,
  state_code: clause.stateCode,
  version: clause.version,
  created_at: clause.createdAt,
  updated_at: clause.updatedAt,
});

const toRentalAgreement = (
  aggregate: RentalAgreementAggregate
): RentalAgreement => {
  const { agreement } = aggregate;
  return {
    id: agreement.id,
    rental_request_id: agreement.rentalRequestId,
    agreement_number: agreement.agreementNumber,
    status: agreement.status,
    customer_type: agreement.customerType,
    customer_name: agreement.customerName,
    business_name: agreement.businessName,
    customer_email: agreement.customerEmail,
    customer_phone: agreement.customerPhone,
    billing_address: agreement.billingAddress,
    service_address: agreement.serviceAddress,
    equipment_requested: agreement.equipmentRequested,
    rental_start_date: agreement.rentalStartDate,
    rental_end_date: agreement.rentalEndDate,
    rental_duration: agreement.rentalDuration,
    fulfillment_type: agreement.fulfillmentType,
    items: [...aggregate.items],
    quote_amount: agreement.quoteAmount,
    deposit_amount: agreement.depositAmount,
    delivery_fee: agreement.deliveryFee,
    tax_amount: agreement.taxAmount,
    total_amount: agreement.totalAmount,
    agreement_html: agreement.agreementHtml,
    signed_pdf_url: agreement.signedPdfUrl,
    effective_at: agreement.effectiveAt,
    signature_status: agreement.signatureStatus,
    acceptance_acknowledged: agreement.acceptanceAcknowledged,
    authorized_signer_name: agreement.authorizedSignerName,
    authorized_signer_title: agreement.authorizedSignerTitle,
    accepted_terms_version: agreement.acceptedTermsVersion,
    credit_card_authorization_acknowledged:
      agreement.creditCardAuthorizationAcknowledged,
    credit_card_authorization_acknowledged_at:
      agreement.creditCardAuthorizationAcknowledgedAt,
    insurance_verification_status: agreement.insuranceVerificationStatus,
    availability_confirmation_status:
      agreement.availabilityConfirmationStatus,
    terms_version: agreement.termsVersion,
    sent_at: agreement.sentAt,
    viewed_at: agreement.viewedAt,
    signed_at: agreement.signedAt,
    signed_by: agreement.signedBy,
    created_at: agreement.createdAt,
    updated_at: agreement.updatedAt,
    clause_snapshot: agreement.clauseSnapshot.map(mapClause),
    clause_snapshot_created_at: agreement.clauseSnapshotCreatedAt,
    locked_at: agreement.lockedAt,
  };
};

export const getRentalAgreementByRequestId = async (
  rentalRequestId: string
): Promise<RentalAgreement | null> => {
  const aggregate = await workflow.getByRentalRequestId(rentalRequestId);
  return aggregate ? toRentalAgreement(aggregate) : null;
};

export const getRentalAgreementById = async (
  agreementId: string
): Promise<RentalAgreement | null> => {
  const aggregate = await workflow.loadAgreement(agreementId);
  return aggregate ? toRentalAgreement(aggregate) : null;
};

export const createRentalAgreement = async (
  rentalRequestId: string
): Promise<RentalAgreement> =>
  toRentalAgreement(await workflow.createOrOpen(rentalRequestId));

export const updateRentalAgreementFinancials = async (
  agreementId: string,
  financials: {
    depositAmount: number;
    deliveryFee: number;
    taxAmount: number;
  }
): Promise<RentalAgreement> =>
  toRentalAgreement(
    await workflow.updateFinancials({ agreementId, ...financials })
  );

export type EditableAgreementFinancialField =
  | "deposit_amount"
  | "delivery_fee"
  | "tax_amount";

export const updateRentalAgreementFinancialField = async (
  agreement: RentalAgreement,
  field: EditableAgreementFinancialField,
  value: number
): Promise<RentalAgreement> =>
  updateRentalAgreementFinancials(agreement.id, {
    depositAmount:
      field === "deposit_amount" ? value : agreement.deposit_amount,
    deliveryFee: field === "delivery_fee" ? value : agreement.delivery_fee,
    taxAmount: field === "tax_amount" ? value : agreement.tax_amount,
  });

export const recordRentalAgreementAcceptance = async (
  command: AgreementAcceptanceCommand
): Promise<RentalAgreement> =>
  toRentalAgreement(await workflow.recordAcceptance(command));

export const finalizeRentalAgreement = async (
  agreementId: string
): Promise<RentalAgreement> =>
  toRentalAgreement(await workflow.finalize(agreementId));

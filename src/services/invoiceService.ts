import { createSupabaseInvoiceRepository } from "../domain/adapters/supabaseInvoiceRepository";
import type { InvoiceAggregate } from "../domain/models/invoice";
import { createInvoiceWorkflowService } from "../domain/services/invoiceWorkflowService";
import { supabase } from "../lib/supabase";
import type { Invoice } from "../types/invoice";

const workflow = createInvoiceWorkflowService(
  createSupabaseInvoiceRepository(supabase)
);

export const toInvoice = (aggregate: InvoiceAggregate): Invoice => {
  const { invoice } = aggregate;
  return {
    id: invoice.id,
    rental_agreement_id: invoice.rentalAgreementId,
    rental_request_id: invoice.rentalRequestId,
    invoice_number: invoice.invoiceNumber,
    invoice_type: invoice.invoiceType,
    status: invoice.status,
    customer_type: invoice.customerType,
    customer_name: invoice.customerName,
    business_name: invoice.businessName,
    customer_email: invoice.customerEmail,
    customer_phone: invoice.customerPhone,
    billing_address: invoice.billingAddress,
    service_address: invoice.serviceAddress,
    equipment_requested: invoice.equipmentRequested,
    rental_start_date: invoice.rentalStartDate,
    rental_end_date: invoice.rentalEndDate,
    source_agreement_snapshot_hash: invoice.sourceAgreementSnapshotHash,
    currency: invoice.currency,
    payment_terms: invoice.paymentTerms,
    items: [...aggregate.items],
    item_source: aggregate.itemSource,
    subtotal: invoice.subtotal,
    deposit_amount: invoice.depositAmount,
    delivery_fee: invoice.deliveryFee,
    tax_amount: invoice.taxAmount,
    other_charges_amount: invoice.otherChargesAmount,
    total_amount: invoice.totalAmount,
    amount_paid: invoice.amountPaid,
    balance_due: invoice.balanceDue,
    payment_status: invoice.paymentStatus,
    payment_link: invoice.paymentLink,
    notes: invoice.notes,
    issue_date: invoice.issueDate,
    issued_at: invoice.issuedAt,
    due_at: invoice.dueAt,
    paid_at: invoice.paidAt,
    voided_at: invoice.voidedAt,
    pdf_url: invoice.pdfUrl,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
  };
};

export const getInvoiceById = async (
  invoiceId: string
): Promise<Invoice | null> => {
  const aggregate = await workflow.loadInvoice(invoiceId);
  return aggregate ? toInvoice(aggregate) : null;
};

export const createInvoiceFromAgreement = async (
  rentalAgreementId: string
): Promise<Invoice> =>
  toInvoice(await workflow.createOrOpen(rentalAgreementId));

export const issueInvoice = async (invoiceId: string): Promise<Invoice> =>
  toInvoice(await workflow.issue(invoiceId));

export { workflow as invoiceWorkflow };

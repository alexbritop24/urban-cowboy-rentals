import { invoiceWorkflow, toInvoice } from "./invoiceService";
import type { Invoice } from "../types/invoice";

export type PaymentMethod =
  | "cash"
  | "card"
  | "check"
  | "ach"
  | "square"
  | "stripe"
  | "other";

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

interface RecordPaymentResult {
  invoice: Invoice;
  paymentId: string;
}

export async function recordPayment(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const result = await invoiceWorkflow.recordPayment(input);
  return {
    invoice: toInvoice(result.invoice),
    paymentId: result.paymentId,
  };
}

export async function getInvoicePayments(invoiceId: string) {
  const payments = await invoiceWorkflow.listPayments(invoiceId);
  return payments.map((payment) => ({
    id: payment.id,
    invoice_id: payment.invoiceId,
    amount: payment.amount,
    payment_method: payment.paymentMethod,
    reference_number: payment.referenceNumber,
    notes: payment.notes,
    received_at: payment.receivedAt,
    created_at: payment.createdAt,
  }));
}

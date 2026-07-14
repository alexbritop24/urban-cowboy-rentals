import { supabase } from "../lib/supabase";
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

export async function recordPayment({
  invoiceId,
  amount,
  paymentMethod,
  referenceNumber,
  notes,
}: RecordPaymentInput): Promise<RecordPaymentResult> {
  if (!invoiceId) {
    throw new Error("Invoice ID is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const { data: currentInvoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (invoiceError) {
    throw invoiceError;
  }

  const invoice = currentInvoice as Invoice;

  if (invoice.status === "draft") {
    throw new Error("Issue the invoice before recording a payment.");
  }

  if (invoice.status === "cancelled") {
    throw new Error("Payments cannot be recorded on a cancelled invoice.");
  }

  const currentAmountPaid = Number(invoice.amount_paid || 0);
  const totalAmount = Number(invoice.total_amount || 0);
  const currentBalanceDue = Number(invoice.balance_due || 0);

  if (currentBalanceDue <= 0) {
    throw new Error("This invoice has already been paid.");
  }

  if (amount > currentBalanceDue) {
    throw new Error(
      `Payment cannot exceed the remaining balance of $${currentBalanceDue.toFixed(
        2
      )}.`
    );
  }

  const newAmountPaid = currentAmountPaid + amount;
  const newBalanceDue = Math.max(totalAmount - newAmountPaid, 0);

  const newPaymentStatus =
    newBalanceDue === 0 ? "paid" : "partially_paid";

  const newInvoiceStatus =
    newBalanceDue === 0 ? "paid" : "partially_paid";

  const paidAt =
    newBalanceDue === 0 ? new Date().toISOString() : null;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      amount,
      payment_method: paymentMethod,
      reference_number: referenceNumber?.trim() || null,
      notes: notes?.trim() || null,
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (paymentError) {
    throw paymentError;
  }

  const { data: updatedInvoice, error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      payment_status: newPaymentStatus,
      status: newInvoiceStatus,
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select("*")
    .single();

  if (updateError) {
    console.error(
      "PAYMENT WAS INSERTED BUT INVOICE UPDATE FAILED:",
      updateError
    );

    throw new Error(
      "The payment was recorded, but the invoice totals could not be updated."
    );
  }

  return {
    invoice: updatedInvoice as Invoice,
    paymentId: payment.id,
  };
}

export async function getInvoicePayments(invoiceId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("received_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}
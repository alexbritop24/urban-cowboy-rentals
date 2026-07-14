import { supabase } from "../lib/supabase";
import type { Invoice } from "../types/invoice";
import type { RentalAgreement } from "../types/agreement";

function generateInvoiceNumber() {
  return `INV-${Date.now()}`;
}

export async function createInvoiceFromAgreement(
  agreement: RentalAgreement
): Promise<Invoice> {
  const { data: existingInvoice, error: existingError } = await supabase
    .from("invoices")
    .select("*")
    .eq("rental_agreement_id", agreement.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingInvoice) {
    return existingInvoice as Invoice;
  }

  const invoice: Omit<
    Invoice,
    "id" | "created_at" | "updated_at"
  > = {
    rental_agreement_id: agreement.id,
    rental_request_id: agreement.rental_request_id,

    invoice_number: generateInvoiceNumber(),

    status: "draft",

    customer_name: agreement.customer_name,
    customer_email: agreement.customer_email,
    customer_phone: agreement.customer_phone,

    equipment_requested: agreement.equipment_requested,

    rental_start_date: agreement.rental_start_date,
    rental_end_date: agreement.rental_end_date,

    subtotal: Number(agreement.quote_amount || 0),

    deposit_amount: Number(agreement.deposit_amount || 0),

    delivery_fee: Number(agreement.delivery_fee || 0),

    tax_amount: Number(agreement.tax_amount || 0),

    total_amount: Number(agreement.total_amount || 0),

    amount_paid: 0,

    balance_due: Number(agreement.total_amount || 0),

    payment_link: null,

    notes: null,

    issued_at: null,

    due_at: null,

    paid_at: null,

    pdf_url: null,
  };

  const { data, error } = await supabase
    .from("invoices")
    .insert(invoice)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Invoice;
}
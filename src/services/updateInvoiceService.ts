import { supabase } from "../lib/supabase";

export async function updateInvoiceField(
  invoiceId: string,
  field:
    | "subtotal"
    | "deposit_amount"
    | "delivery_fee"
    | "tax_amount",
  value: number
) {
  const { data: current, error: currentError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (currentError) {
    throw currentError;
  }

  const subtotal =
    field === "subtotal"
      ? value
      : Number(current.subtotal);

  const deposit =
    field === "deposit_amount"
      ? value
      : Number(current.deposit_amount);

  const delivery =
    field === "delivery_fee"
      ? value
      : Number(current.delivery_fee);

  const tax =
    field === "tax_amount"
      ? value
      : Number(current.tax_amount);

  const total =
    subtotal +
    deposit +
    delivery +
    tax;

  const balanceDue =
    total - Number(current.amount_paid);

  const { error } = await supabase
    .from("invoices")
    .update({
      [field]: value,
      total_amount: total,
      balance_due: balanceDue,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (error) {
    throw error;
  }

  return {
    total,
    balanceDue,
  };
}
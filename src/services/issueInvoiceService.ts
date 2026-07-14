import { supabase } from "../lib/supabase";

export async function issueInvoice(invoiceId: string) {
  const issuedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "issued",
      issued_at: issuedAt,
      updated_at: issuedAt,
    })
    .eq("id", invoiceId)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}
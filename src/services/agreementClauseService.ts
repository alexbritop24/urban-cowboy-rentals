import { supabase } from "../lib/supabase";
import type { AgreementClause } from "../types/agreementClause";

export async function getAgreementClauses(): Promise<AgreementClause[]> {
  const { data, error } = await supabase
    .from("agreement_clauses")
    .select("*")
    .eq("enabled", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? (data as AgreementClause[]) : [];
}

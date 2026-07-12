import { supabase } from "../lib/supabase";
import type { AgreementClause } from "../types/agreementClause";

export async function getAgreementClauses() {
  const { data, error } = await supabase
    .from("agreement_clauses")
    .select("*")
    .eq("enabled", true)
    .order("display_order");

  if (error) throw error;

  return data as AgreementClause[];
}
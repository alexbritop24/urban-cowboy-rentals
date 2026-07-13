import { supabase } from "../lib/supabase";
import type { RentalAgreement } from "../types/agreement";
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

export async function finalizeAgreement(
  agreementId: string,
  clauses: AgreementClause[]
): Promise<RentalAgreement> {
  const finalizedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("rental_agreements")
    .update({
      clause_snapshot: clauses,
      clause_snapshot_created_at: finalizedAt,
      locked_at: finalizedAt,
      status: "ready",
      updated_at: finalizedAt,
    })
    .eq("id", agreementId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RentalAgreement;
}
import { supabase } from "../lib/supabase";
import type { RentalAgreement } from "../types/agreement";
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

export async function createAgreementClauseSnapshot(
  agreementId: string,
  clauses: AgreementClause[]
) {
  const snapshotCreatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("rental_agreements")
    .update({
      clause_snapshot: clauses,
      clause_snapshot_created_at: snapshotCreatedAt,
      locked_at: snapshotCreatedAt,
    })
    .eq("id", agreementId)
    .select("*")
    .single();

  if (error) throw error;

  return data as RentalAgreement;
}
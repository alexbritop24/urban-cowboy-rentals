import type { RentalAgreement } from "../types/agreement";
import type { AgreementClause } from "../types/agreementClause";
import { sanitizeInvoicePdfText } from "../components/agreement/pdf/sanitizeInvoicePdfText";
import { cleanReview } from "../../scripts/review-agreement/populate-review.mjs";

export interface ApprovedBlock {
  kind: string;
  title?: string;
  subtitle?: string;
  text?: string;
  rows?: string[][];
  notes?: string[];
  widths?: number[];
}
export function hasApprovedDocument(clauses: AgreementClause[]): boolean {
  return clauses.some(clause => clause.category === "ucr_document_v1");
}
export function buildApprovedDocument(agreement: RentalAgreement) {
  const clauses = agreement.clause_snapshot;
  if (!hasApprovedDocument(clauses)) return null;
  if (clauses.length !== 1 || clauses[0].category !== "ucr_document_v1") {
    throw new Error("The approved Agreement snapshot contains conflicting clause sets.");
  }
  const source = JSON.parse(clauses[0].body);
  if (source.schema !== "ucr-approved-equipment-lease/v1" || !Array.isArray(source.blocks) || !source.blocks.length) {
    throw new Error("The approved Agreement snapshot has an unsupported document version.");
  }
  // This versioned mapping reads the frozen source in this Agreement, never active clauses.
  const fixture = cleanReview(source, agreement, {sample: false});
  const accepted = agreement.acceptance_acknowledged &&
    ["accepted", "signed"].includes(agreement.signature_status) &&
    agreement.accepted_terms_version === agreement.terms_version &&
    agreement.accepted_snapshot_hash === agreement.current_snapshot_hash;
  const blocks = fixture.blocks as ApprovedBlock[];
  const evidence: ApprovedBlock = {
    kind: "details", title: "Agreement Acceptance and Payment Authorization",
    rows: [
      ["Acceptance", accepted ? "Recorded for this Agreement" : "Awaiting acceptance"],
      ["Authorized signer", accepted ? agreement.authorized_signer_name || "" : ""],
      ["Signer title", accepted ? agreement.authorized_signer_title || "" : ""],
      ["Acceptance date", accepted ? agreement.signed_at || "" : ""],
      ["Payment authorization", accepted && agreement.credit_card_authorization_acknowledged
        ? "Acknowledgment recorded for this Agreement" : "Awaiting acknowledgment"],
    ],
  };
  // Actual evidence is shown separately; never infer a lessor/cardholder signature.
  evidence.rows = evidence.rows?.map(row => row.map(value => sanitizeInvoicePdfText(value)));
  blocks.push(evidence);
  if (agreement.credit_card_authorization_terms) blocks.push({
    kind:"paragraph", text:sanitizeInvoicePdfText(agreement.credit_card_authorization_terms),
  });
  return {...fixture, blocks, population: {...fixture.population, approved:true, status:agreement.status}};
}

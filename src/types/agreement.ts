import type { AgreementItem } from "../domain/models/agreementItem";
import type { AgreementClause } from "./agreementClause";

export interface RentalAgreement {
  id: string;
  rental_request_id: string;
  agreement_number: string;
  status: "draft" | "sent" | "viewed" | "ready" | "signed" | "cancelled";

  customer_type: "individual" | "business";
  customer_name: string;
  business_name: string | null;
  customer_email: string;
  customer_phone: string;
  billing_address: string | null;
  service_address: string | null;

  equipment_requested: string;
  rental_start_date: string | null;
  rental_end_date: string | null;
  rental_duration: string | null;
  fulfillment_type: string | null;
  items: AgreementItem[];

  quote_amount: number;
  deposit_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;

  agreement_html: string | null;
  signed_pdf_url: string | null;
  effective_at: string;
  signature_status: "pending" | "accepted" | "signed";
  acceptance_acknowledged: boolean;
  authorized_signer_name: string | null;
  authorized_signer_title: string | null;
  accepted_terms_version: string | null;
  credit_card_authorization_acknowledged: boolean;
  credit_card_authorization_acknowledged_at: string | null;
  insurance_verification_status: "pending" | "verified" | "rejected";
  availability_confirmation_status:
    | "pending_review"
    | "available"
    | "approved"
    | "conflict"
    | "unavailable";
  terms_version: string;

  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
  updated_at: string;

  clause_snapshot: AgreementClause[];
  clause_snapshot_created_at: string;
  locked_at: string | null;
}

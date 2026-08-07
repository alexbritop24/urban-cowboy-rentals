import type { InvoiceItem } from "../domain/models/invoiceItem";

export interface Invoice {
  id: string;

  rental_agreement_id: string | null;
  rental_request_id: string | null;

  invoice_number: string;
  invoice_type:
    | "original_rental"
    | "adjustment"
    | "credit_note"
    | "replacement"
    | "damage_charge";

  status:
    | "draft"
    | "issued"
    | "partially_paid"
    | "paid"
    | "overdue"
    | "cancelled"
    | "void";

  customer_type: "individual" | "business" | null;
  customer_name: string;
  business_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  billing_address: string | null;
  service_address: string | null;

  equipment_requested: string | null;

  rental_start_date: string | null;
  rental_end_date: string | null;
  source_agreement_snapshot_hash: string | null;
  currency: string;
  payment_terms: string;
  items: InvoiceItem[];
  item_source: "normalized" | "legacy" | "unavailable";

  subtotal: number;

  deposit_amount: number;

  delivery_fee: number;

  tax_amount: number;
  other_charges_amount: number;

  total_amount: number;

  amount_paid: number;

  balance_due: number;
  payment_status: string;

  payment_link: string | null;

  notes: string | null;

  issue_date: string | null;

  issued_at: string | null;

  due_at: string | null;

  paid_at: string | null;

  voided_at: string | null;

  pdf_url: string | null;

  created_at: string;

  updated_at: string;
}

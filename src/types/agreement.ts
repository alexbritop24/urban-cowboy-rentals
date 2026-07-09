export interface RentalAgreement {
  id: string;
  rental_request_id: string;
  agreement_number: string;
  status: "draft" | "sent" | "viewed" | "signed" | "cancelled";

  customer_name: string;
  customer_email: string;
  customer_phone: string;

  equipment_requested: string;
  rental_start_date: string;
  rental_end_date: string;
  rental_duration: string;
  fulfillment_type: string;

  quote_amount: number | null;
  deposit_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;

  agreement_html: string | null;
  signed_pdf_url: string | null;

  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;

  created_at: string;
  updated_at: string;
}
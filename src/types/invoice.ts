export interface Invoice {
  id: string;

  rental_agreement_id: string;
  rental_request_id: string | null;

  invoice_number: string;

  status:
    | "draft"
    | "issued"
    | "partially_paid"
    | "paid"
    | "overdue"
    | "cancelled";

  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;

  equipment_requested: string;

  rental_start_date: string | null;
  rental_end_date: string | null;

  subtotal: number;

  deposit_amount: number;

  delivery_fee: number;

  tax_amount: number;

  total_amount: number;

  amount_paid: number;

  balance_due: number;

  payment_link: string | null;

  notes: string | null;

  issued_at: string | null;

  due_at: string | null;

  paid_at: string | null;

  pdf_url: string | null;

  created_at: string;

  updated_at: string;
}
import type { CalculatedRentalItem } from "./rentalItem";

export interface InvoiceItem extends CalculatedRentalItem {
  invoiceId: string;
  agreementItemId: string | null;
  rentalRequestItemId: string | null;
  createdAt: string | null;
}

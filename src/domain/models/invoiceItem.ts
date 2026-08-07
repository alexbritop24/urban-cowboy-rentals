import type { CalculatedRentalItem } from "./rentalItem";

export interface InvoiceItem extends Omit<CalculatedRentalItem, "quantity"> {
  quantity: number | null;
  invoiceId: string;
  agreementItemId: string | null;
  rentalRequestItemId: string | null;
  createdAt: string | null;
}

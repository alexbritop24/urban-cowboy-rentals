import type { AgreementItem } from "./agreementItem";
import type { InvoiceItem } from "./invoiceItem";
import type { RentalRequestItem } from "./rentalRequestItem";

export interface RentalRequestItemRepository {
  findByRentalRequestId(
    rentalRequestId: string
  ): Promise<readonly RentalRequestItem[]>;
}

export interface AgreementItemRepository {
  findByRentalAgreementId(
    rentalAgreementId: string
  ): Promise<readonly AgreementItem[]>;
}

export interface InvoiceItemRepository {
  findByInvoiceId(invoiceId: string): Promise<readonly InvoiceItem[]>;
}

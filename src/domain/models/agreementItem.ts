import type { CalculatedRentalItem } from "./rentalItem";

export interface AgreementItem extends CalculatedRentalItem {
  rentalAgreementId: string;
  rentalRequestItemId: string | null;
  createdAt: string | null;
}

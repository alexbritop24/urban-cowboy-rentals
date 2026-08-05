import type { RentalItem } from "./rentalItem";

export interface RentalRequestItem extends RentalItem {
  rentalRequestId: string;
  createdAt: string | null;
  updatedAt: string | null;
}

import type { LegacyItemFields } from "./legacyItemFields";
import type { RentalRequestItem } from "./rentalRequestItem";

export type CustomerType = "individual" | "business";

export interface RentalRequestItemDraft {
  clientId: string;
  equipmentId: string;
  equipmentName: string;
  startDate: string;
  endDate: string;
  quantity: number;
  dailyRate: number;
  serialNumber: string | null;
  notes: string;
}

export interface RentalRequestSubmission {
  customerType: CustomerType;
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  fulfillmentType: "Pickup" | "Delivery";
  projectType: string;
  notes: string;
  agreementAccepted: boolean;
  items: readonly RentalRequestItemDraft[];
}

export interface PreparedRentalRequestCommand {
  request: Omit<RentalRequestSubmission, "items">;
  items: readonly RentalRequestItem[];
  legacyFields: LegacyItemFields;
  pickupDate: string;
  returnDate: string;
  rentalDuration: string;
  estimatedSubtotal: number;
}

export interface RentalRequestCreationResult {
  rentalRequestId: string;
}

export interface ReplaceRentalRequestItemsCommand {
  rentalRequestId: string;
  items: readonly RentalRequestItem[];
  legacyFields: LegacyItemFields;
  pickupDate: string;
  returnDate: string;
  rentalDuration: string;
  estimatedSubtotal: number;
}

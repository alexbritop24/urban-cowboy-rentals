export type RentalItemOrigin = "normalized" | "legacy";

export interface RentalItem {
  id: string;
  displayOrder: number;
  equipmentId: string | null;
  equipmentName: string;
  startDate: string;
  endDate: string;
  quantity: number;
  dailyRate: number;
  serialNumber: string | null;
  notes: string | null;
  origin: RentalItemOrigin;
}

export interface CalculatedRentalItem extends RentalItem {
  billableDays: number;
  lineTotal: number;
}

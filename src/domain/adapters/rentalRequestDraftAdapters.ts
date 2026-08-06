import type { RentalRequestItem } from "../models/rentalRequestItem";
import type { RentalRequestItemDraft } from "../models/rentalRequestWorkflow";

export const rentalRequestDraftsToItems = (
  drafts: readonly RentalRequestItemDraft[],
  rentalRequestId: string
): RentalRequestItem[] =>
  drafts.map((draft, index) => ({
    id: draft.clientId,
    rentalRequestId,
    displayOrder: index,
    equipmentId: draft.equipmentId || null,
    equipmentName: draft.equipmentName,
    startDate: draft.startDate,
    endDate: draft.endDate,
    quantity: draft.quantity,
    dailyRate: draft.dailyRate,
    serialNumber: draft.serialNumber,
    notes: draft.notes.trim() || null,
    origin: "normalized",
    createdAt: null,
    updatedAt: null,
  }));

export const rentalRequestItemsToDrafts = (
  items: readonly RentalRequestItem[]
): RentalRequestItemDraft[] =>
  [...items]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((item) => ({
      clientId: item.id,
      equipmentId: item.equipmentId ?? "",
      equipmentName: item.equipmentName,
      startDate: item.startDate,
      endDate: item.endDate,
      quantity: item.quantity,
      dailyRate: item.dailyRate,
      serialNumber: item.serialNumber,
      notes: item.notes ?? "",
    }));

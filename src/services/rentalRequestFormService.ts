import {
  getBookableEquipment,
  getEquipmentDailyRate,
} from "../data/equipmentSelectors";
import { rentalRequestItemsToDrafts } from "../domain/adapters/rentalRequestDraftAdapters";
import type { DomainValidationIssue } from "../domain/errors/DomainValidationError";
import type { RentalRequestItem } from "../domain/models/rentalRequestItem";
import type {
  RentalRequestItemDraft,
  RentalRequestSubmission,
} from "../domain/models/rentalRequestWorkflow";
import {
  calculateRentalItemPricing,
  calculateRentalItemsSubtotal,
} from "../domain/pricing/rentalPricing";
import { validateRentalRequestSubmission } from "../domain/validators/rentalRequestWorkflowValidators";

export interface RentalRequestItemPricingViewModel {
  billableDays: number;
  lineTotal: number;
}

export interface RentalRequestPricingViewModel {
  subtotal: number;
}

interface RentalRequestItemDates {
  startDate: string;
  endDate: string;
}

const equipmentOptions = getBookableEquipment();

const createClientId = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getRentalRequestEquipmentOptions = () => equipmentOptions;

export const createRentalRequestDraftItem = (
  equipmentId = "",
  dates?: RentalRequestItemDates
): RentalRequestItemDraft => {
  const equipment = equipmentOptions.find((item) => item.id === equipmentId);

  return {
    clientId: createClientId(),
    equipmentId: equipment?.id ?? "",
    equipmentName: equipment?.name ?? "",
    startDate: dates?.startDate ?? "",
    endDate: dates?.endDate ?? "",
    quantity: 1,
    dailyRate: equipment ? getEquipmentDailyRate(equipment) : 0,
    serialNumber: null,
    notes: "",
  };
};

export const addRentalRequestDraftItem = (
  items: readonly RentalRequestItemDraft[]
): RentalRequestItemDraft[] => {
  const previousItem = items.at(-1);
  const dates = previousItem
    ? { startDate: previousItem.startDate, endDate: previousItem.endDate }
    : undefined;

  return [...items, createRentalRequestDraftItem("", dates)];
};

export const selectRentalRequestDraftEquipment = (
  item: RentalRequestItemDraft,
  equipmentId: string
): RentalRequestItemDraft => {
  const equipment = equipmentOptions.find((option) => option.id === equipmentId);

  return {
    ...item,
    equipmentId: equipment?.id ?? "",
    equipmentName: equipment?.name ?? "",
    dailyRate: equipment ? getEquipmentDailyRate(equipment) : 0,
    serialNumber: null,
  };
};

export const prepareRentalRequestItemPricing = (
  item: RentalRequestItemDraft
): RentalRequestItemPricingViewModel | null => {
  try {
    return calculateRentalItemPricing(item);
  } catch {
    return null;
  }
};

export const prepareRentalRequestPricing = (
  items: readonly RentalRequestItemDraft[]
): RentalRequestPricingViewModel | null => {
  try {
    return { subtotal: calculateRentalItemsSubtotal(items) };
  } catch {
    return null;
  }
};

export const validateRentalRequestFormSubmission = (
  submission: RentalRequestSubmission
): DomainValidationIssue[] => validateRentalRequestSubmission(submission);

export const prepareRentalRequestDraftsForEditing = (
  items: readonly RentalRequestItem[]
): RentalRequestItemDraft[] => rentalRequestItemsToDrafts(items);

export const isRentalRequestStatusEditable = (status: string): boolean =>
  status === "new";

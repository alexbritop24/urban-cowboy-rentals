import {
  DEFAULT_DAILY_RATE,
  DEFAULT_DISPLAY_ORDER,
  DEFAULT_ITEM_QUANTITY,
} from "../constants/rentalDefaults";
import { calculateRentalDays, calculateLineTotal } from "../pricing/rentalPricing";
import type { AgreementItem } from "../models/agreementItem";
import type { InvoiceItem } from "../models/invoiceItem";
import type {
  LegacyItemFields,
  LegacyItemFieldSource,
} from "../models/legacyItemFields";
import type { RentalItem } from "../models/rentalItem";
import type { RentalRequestItem } from "../models/rentalRequestItem";

export type { LegacyItemFields } from "../models/legacyItemFields";

export interface LegacyItemDefaults {
  equipmentId?: string | null;
  dailyRate?: number;
  serialNumber?: string | null;
  notes?: string | null;
}

const legacyItemId = (parentType: string, parentId: string): string =>
  `legacy:${parentType}:${parentId}`;

const createLegacyBaseItem = (
  parentType: string,
  parentId: string,
  legacy: LegacyItemFields,
  defaults: LegacyItemDefaults
): RentalItem => ({
  id: legacyItemId(parentType, parentId),
  displayOrder: DEFAULT_DISPLAY_ORDER,
  equipmentId: defaults.equipmentId ?? null,
  equipmentName: legacy.equipment_requested ?? "",
  startDate: legacy.rental_start_date ?? "",
  endDate: legacy.rental_end_date ?? "",
  quantity: DEFAULT_ITEM_QUANTITY,
  dailyRate: defaults.dailyRate ?? DEFAULT_DAILY_RATE,
  serialNumber: defaults.serialNumber ?? null,
  notes: defaults.notes ?? null,
  origin: "legacy",
});

const calculateLegacyAmounts = (
  baseItem: RentalItem,
  fallbackLineTotal: number
): { billableDays: number; lineTotal: number } => {
  try {
    const billableDays = calculateRentalDays(baseItem.startDate, baseItem.endDate);
    return {
      billableDays,
      lineTotal:
        baseItem.dailyRate > 0
          ? calculateLineTotal(
              baseItem.dailyRate,
              billableDays,
              baseItem.quantity
            )
          : fallbackLineTotal,
    };
  } catch {
    return {
      billableDays: 1,
      lineTotal: fallbackLineTotal,
    };
  }
};

export const adaptLegacyRentalRequestItem = (
  rentalRequestId: string,
  legacy: LegacyItemFields,
  defaults: LegacyItemDefaults = {}
): RentalRequestItem => ({
  ...createLegacyBaseItem("rental-request", rentalRequestId, legacy, defaults),
  rentalRequestId,
  createdAt: null,
  updatedAt: null,
});

export const adaptLegacyAgreementItem = (
  rentalAgreementId: string,
  legacy: LegacyItemFields,
  defaults: LegacyItemDefaults & { lineTotal?: number } = {}
): AgreementItem => {
  const baseItem = createLegacyBaseItem(
    "agreement",
    rentalAgreementId,
    legacy,
    defaults
  );
  const calculated = calculateLegacyAmounts(baseItem, defaults.lineTotal ?? 0);

  return {
    ...baseItem,
    ...calculated,
    rentalAgreementId,
    rentalRequestItemId: null,
    createdAt: null,
  };
};

export const adaptLegacyInvoiceItem = (
  invoiceId: string,
  legacy: LegacyItemFields,
  defaults: LegacyItemDefaults & { lineTotal?: number } = {}
): InvoiceItem => {
  const baseItem = createLegacyBaseItem("invoice", invoiceId, legacy, defaults);
  const calculated = calculateLegacyAmounts(baseItem, defaults.lineTotal ?? 0);

  return {
    ...baseItem,
    ...calculated,
    invoiceId,
    agreementItemId: null,
    createdAt: null,
  };
};

export const summarizeItemsForLegacy = (
  items: readonly RentalItem[]
): LegacyItemFields => {
  const orderedItems = [...items].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );
  const equipmentNames = orderedItems
    .map((item) => item.equipmentName.trim())
    .filter(Boolean);
  const startDates = orderedItems.map((item) => item.startDate).filter(Boolean);
  const endDates = orderedItems.map((item) => item.endDate).filter(Boolean);

  return {
    equipment_requested: equipmentNames.length > 0 ? equipmentNames.join(", ") : null,
    rental_start_date:
      startDates.length > 0 ? [...startDates].sort()[0] ?? null : null,
    rental_end_date:
      endDates.length > 0 ? [...endDates].sort().at(-1) ?? null : null,
  };
};

export const rentalRequestItemsToLegacyFields = summarizeItemsForLegacy;
export const agreementItemsToLegacyFields = summarizeItemsForLegacy;
export const invoiceItemsToLegacyFields = summarizeItemsForLegacy;

export const legacyItemFieldsFromSource = (
  source: LegacyItemFieldSource
): LegacyItemFields => ({
  equipment_requested: source.equipment_requested ?? null,
  rental_start_date: source.rental_start_date ?? null,
  rental_end_date: source.rental_end_date ?? null,
});

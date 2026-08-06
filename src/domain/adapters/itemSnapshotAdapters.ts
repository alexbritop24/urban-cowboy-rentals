import type { AgreementItem } from "../models/agreementItem";
import type { InvoiceItem } from "../models/invoiceItem";
import type { RentalRequestItem } from "../models/rentalRequestItem";
import { calculateLineTotal, calculateRentalDays } from "../pricing/rentalPricing";

export type ItemIdFactory = () => string;

export interface AgreementSnapshotInput {
  rentalAgreementId: string;
  createId: ItemIdFactory;
}

export interface InvoiceSnapshotInput {
  invoiceId: string;
  createId: ItemIdFactory;
}

export const rentalRequestItemsToAgreementItems = (
  requestItems: readonly RentalRequestItem[],
  input: AgreementSnapshotInput
): AgreementItem[] =>
  requestItems.map((item) => {
    const billableDays = calculateRentalDays(item.startDate, item.endDate);

    return {
      ...item,
      id: input.createId(),
      origin: item.origin,
      rentalAgreementId: input.rentalAgreementId,
      rentalRequestItemId: item.origin === "normalized" ? item.id : null,
      billableDays,
      lineTotal: calculateLineTotal(item.dailyRate, billableDays, item.quantity),
      createdAt: null,
    };
  });

export const agreementItemsToInvoiceItems = (
  agreementItems: readonly AgreementItem[],
  input: InvoiceSnapshotInput
): InvoiceItem[] =>
  agreementItems.map((item) => ({
    ...item,
    id: input.createId(),
    origin: item.origin,
    invoiceId: input.invoiceId,
    agreementItemId: item.origin === "normalized" ? item.id : null,
    createdAt: null,
  }));

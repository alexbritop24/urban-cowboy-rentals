import {
  adaptLegacyInvoiceItem,
  invoiceItemsToLegacyFields,
  type LegacyItemDefaults,
} from "../adapters/legacyItemAdapters";
import {
  agreementItemsToInvoiceItems,
  type InvoiceSnapshotInput,
} from "../adapters/itemSnapshotAdapters";
import {
  multiItemFeatureFlags,
  type MultiItemFeatureFlags,
} from "../featureFlags/multiItemFeatureFlags";
import type { AgreementItem } from "../models/agreementItem";
import type { ItemResolution, PreparedItemCollection } from "../models/itemResolution";
import type { InvoiceItemRepository } from "../models/itemRepositories";
import type { LegacyItemFields } from "../models/legacyItemFields";
import type { InvoiceItem } from "../models/invoiceItem";
import {
  assertValidInvoiceItems,
  type ItemValidationOptions,
} from "../validators/rentalItemValidators";
import { resolveItems } from "./itemServiceSupport";

export interface ResolveInvoiceItemsInput {
  invoiceId: string;
  legacyFields: LegacyItemFields;
  legacyDefaults?: LegacyItemDefaults & { lineTotal?: number };
}

export interface InvoiceItemService {
  resolveItems(input: ResolveInvoiceItemsInput): Promise<ItemResolution<InvoiceItem>>;
  createFromAgreementItems(
    agreementItems: readonly AgreementItem[],
    input: InvoiceSnapshotInput
  ): PreparedItemCollection<InvoiceItem>;
  prepareForPersistence(
    items: readonly InvoiceItem[],
    validationOptions?: ItemValidationOptions
  ): PreparedItemCollection<InvoiceItem>;
}

export const createInvoiceItemService = (
  repository?: InvoiceItemRepository,
  flags: Readonly<MultiItemFeatureFlags> = multiItemFeatureFlags
): InvoiceItemService => {
  const prepareForPersistence = (
    items: readonly InvoiceItem[],
    validationOptions: ItemValidationOptions = {}
  ): PreparedItemCollection<InvoiceItem> => {
    assertValidInvoiceItems(items, validationOptions);
    return {
      items: [...items],
      legacyFields: invoiceItemsToLegacyFields(items),
    };
  };

  return {
    async resolveItems(input) {
      return resolveItems({
        flags,
        repositoryAvailable: Boolean(repository),
        loadNormalizedItems: () =>
          repository
            ? repository.findByInvoiceId(input.invoiceId)
            : Promise.resolve([]),
        createLegacyItem: () =>
          adaptLegacyInvoiceItem(
            input.invoiceId,
            input.legacyFields,
            input.legacyDefaults
          ),
        summarizeLegacyFields: invoiceItemsToLegacyFields,
        assertValidNormalizedItems: (items) => assertValidInvoiceItems(items),
      });
    },

    createFromAgreementItems(agreementItems, input) {
      return prepareForPersistence(
        agreementItemsToInvoiceItems(agreementItems, input),
        { requireNormalizedLineage: true, requireSerialNumber: true }
      );
    },

    prepareForPersistence,
  };
};

import {
  adaptLegacyAgreementItem,
  agreementItemsToLegacyFields,
  type LegacyItemDefaults,
} from "../adapters/legacyItemAdapters";
import {
  rentalRequestItemsToAgreementItems,
  type AgreementSnapshotInput,
} from "../adapters/itemSnapshotAdapters";
import {
  multiItemFeatureFlags,
  type MultiItemFeatureFlags,
} from "../featureFlags/multiItemFeatureFlags";
import type { AgreementItem } from "../models/agreementItem";
import type { ItemResolution, PreparedItemCollection } from "../models/itemResolution";
import type { AgreementItemRepository } from "../models/itemRepositories";
import type { LegacyItemFields } from "../models/legacyItemFields";
import type { RentalRequestItem } from "../models/rentalRequestItem";
import {
  assertValidAgreementItems,
  type ItemValidationOptions,
} from "../validators/rentalItemValidators";
import { resolveItems } from "./itemServiceSupport";

export interface ResolveAgreementItemsInput {
  rentalAgreementId: string;
  legacyFields: LegacyItemFields;
  legacyDefaults?: LegacyItemDefaults & { lineTotal?: number };
}

export interface AgreementItemService {
  resolveItems(
    input: ResolveAgreementItemsInput
  ): Promise<ItemResolution<AgreementItem>>;
  createFromRequestItems(
    requestItems: readonly RentalRequestItem[],
    input: AgreementSnapshotInput
  ): PreparedItemCollection<AgreementItem>;
  prepareForPersistence(
    items: readonly AgreementItem[],
    validationOptions?: ItemValidationOptions
  ): PreparedItemCollection<AgreementItem>;
}

export const createAgreementItemService = (
  repository?: AgreementItemRepository,
  flags: Readonly<MultiItemFeatureFlags> = multiItemFeatureFlags
): AgreementItemService => {
  const prepareForPersistence = (
    items: readonly AgreementItem[],
    validationOptions: ItemValidationOptions = {}
  ): PreparedItemCollection<AgreementItem> => {
    assertValidAgreementItems(items, validationOptions);
    return {
      items: [...items],
      legacyFields: agreementItemsToLegacyFields(items),
    };
  };

  return {
    async resolveItems(input) {
      return resolveItems({
        flags,
        repositoryAvailable: Boolean(repository),
        loadNormalizedItems: () =>
          repository
            ? repository.findByRentalAgreementId(input.rentalAgreementId)
            : Promise.resolve([]),
        createLegacyItem: () =>
          adaptLegacyAgreementItem(
            input.rentalAgreementId,
            input.legacyFields,
            input.legacyDefaults
          ),
        summarizeLegacyFields: agreementItemsToLegacyFields,
        assertValidNormalizedItems: (items) => assertValidAgreementItems(items),
      });
    },

    createFromRequestItems(requestItems, input) {
      return prepareForPersistence(
        rentalRequestItemsToAgreementItems(requestItems, input),
        { requireNormalizedLineage: true, requireSerialNumber: true }
      );
    },

    prepareForPersistence,
  };
};

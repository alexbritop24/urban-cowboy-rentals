import {
  adaptLegacyRentalRequestItem,
  rentalRequestItemsToLegacyFields,
  type LegacyItemDefaults,
} from "../adapters/legacyItemAdapters";
import {
  multiItemFeatureFlags,
  type MultiItemFeatureFlags,
} from "../featureFlags/multiItemFeatureFlags";
import type { ItemResolution, PreparedItemCollection } from "../models/itemResolution";
import type { RentalRequestItemRepository } from "../models/itemRepositories";
import type { LegacyItemFields } from "../models/legacyItemFields";
import type { RentalRequestItem } from "../models/rentalRequestItem";
import {
  assertValidRentalRequestItems,
  type ItemValidationOptions,
} from "../validators/rentalItemValidators";
import { resolveItems } from "./itemServiceSupport";

export interface ResolveRentalRequestItemsInput {
  rentalRequestId: string;
  legacyFields: LegacyItemFields;
  legacyDefaults?: LegacyItemDefaults;
}

export interface RentalRequestItemService {
  resolveItems(
    input: ResolveRentalRequestItemsInput
  ): Promise<ItemResolution<RentalRequestItem>>;
  prepareForPersistence(
    items: readonly RentalRequestItem[],
    validationOptions?: ItemValidationOptions
  ): PreparedItemCollection<RentalRequestItem>;
}

export const createRentalRequestItemService = (
  repository?: RentalRequestItemRepository,
  flags: Readonly<MultiItemFeatureFlags> = multiItemFeatureFlags
): RentalRequestItemService => ({
  async resolveItems(input) {
    return resolveItems({
      flags,
      repositoryAvailable: Boolean(repository),
      loadNormalizedItems: () =>
        repository
          ? repository.findByRentalRequestId(input.rentalRequestId)
          : Promise.resolve([]),
      createLegacyItem: () =>
        adaptLegacyRentalRequestItem(
          input.rentalRequestId,
          input.legacyFields,
          input.legacyDefaults
        ),
      summarizeLegacyFields: rentalRequestItemsToLegacyFields,
      assertValidNormalizedItems: (items) =>
        assertValidRentalRequestItems(items),
    });
  },

  prepareForPersistence(items, validationOptions) {
    assertValidRentalRequestItems(items, validationOptions);
    return {
      items: [...items],
      legacyFields: rentalRequestItemsToLegacyFields(items),
    };
  },
});

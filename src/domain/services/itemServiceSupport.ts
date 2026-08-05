import type { LegacyItemFields } from "../adapters/legacyItemAdapters";
import { DomainValidationError } from "../errors/DomainValidationError";
import type { MultiItemFeatureFlags } from "../featureFlags/multiItemFeatureFlags";
import type { ItemResolution } from "../models/itemResolution";
import type { RentalItem } from "../models/rentalItem";

interface ResolveItemsInput<TItem extends RentalItem> {
  flags: Readonly<MultiItemFeatureFlags>;
  repositoryAvailable: boolean;
  loadNormalizedItems: () => Promise<readonly TItem[]>;
  createLegacyItem: () => TItem;
  summarizeLegacyFields: (items: readonly TItem[]) => LegacyItemFields;
  assertValidNormalizedItems: (items: readonly TItem[]) => void;
}

export const resolveItems = async <TItem extends RentalItem>({
  flags,
  repositoryAvailable,
  loadNormalizedItems,
  createLegacyItem,
  summarizeLegacyFields,
  assertValidNormalizedItems,
}: ResolveItemsInput<TItem>): Promise<ItemResolution<TItem>> => {
  if (flags.readNormalizedItems && !repositoryAvailable) {
    throw new DomainValidationError(
      [
        {
          code: "feature_configuration_error",
          path: "repository",
          message: "Normalized item reads require an item repository.",
        },
      ],
      "The normalized item feature is not configured."
    );
  }

  if (flags.readNormalizedItems) {
    const normalizedItems = await loadNormalizedItems();

    if (normalizedItems.length > 0) {
      assertValidNormalizedItems(normalizedItems);
      return {
        items: normalizedItems,
        source: "normalized",
        legacyFields: summarizeLegacyFields(normalizedItems),
      };
    }
  }

  const legacyItems = [createLegacyItem()];
  return {
    items: legacyItems,
    source: "legacy",
    legacyFields: summarizeLegacyFields(legacyItems),
  };
};

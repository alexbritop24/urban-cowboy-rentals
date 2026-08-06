import type { MultiItemFeatureFlags } from "../domain/featureFlags/multiItemFeatureFlags";

const multiItemRentalRequestsEnabled =
  import.meta.env.VITE_ENABLE_MULTI_ITEM_RENTAL_REQUESTS === "true";

export const applicationFeatureFlags = Object.freeze({
  multiItemRentalRequests: multiItemRentalRequestsEnabled,
});

export const rentalRequestItemFeatureFlags: Readonly<MultiItemFeatureFlags> =
  Object.freeze({
    readNormalizedItems: multiItemRentalRequestsEnabled,
    writeNormalizedItems: multiItemRentalRequestsEnabled,
  });

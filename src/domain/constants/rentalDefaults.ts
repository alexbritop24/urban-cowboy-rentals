export const DEFAULT_DAILY_RATE = 0;
export const DEFAULT_ITEM_QUANTITY = 1;
export const DEFAULT_DISPLAY_ORDER = 0;

export type RentalDayPolicy =
  | "elapsed-24-hour-periods"
  | "calendar-days-inclusive";

// This policy is not wired to the current UI. Sprint 2B must confirm the
// accounting day-count rule before normalized totals become authoritative.
export const DEFAULT_RENTAL_DAY_POLICY: RentalDayPolicy =
  "elapsed-24-hour-periods";

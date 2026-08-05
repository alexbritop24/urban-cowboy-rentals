import type { LegacyItemFields } from "./legacyItemFields";

export interface ItemResolution<TItem> {
  items: readonly TItem[];
  source: "normalized" | "legacy";
  legacyFields: LegacyItemFields;
}

export interface PreparedItemCollection<TItem> {
  items: readonly TItem[];
  legacyFields: LegacyItemFields;
}

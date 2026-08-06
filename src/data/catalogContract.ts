import catalogSource from "./publicRentalCatalog.json";
import type {
  EquipmentCatalogMetadata,
  EquipmentCategory,
} from "../types/equipment";

const isEquipmentCategory = (value: string): value is EquipmentCategory =>
  ["Heavy Equipment", "Trailers", "Tools", "Motorcycles"].includes(value);

const catalogEntries: readonly EquipmentCatalogMetadata[] = catalogSource.map(
  (entry) => {
    if (!isEquipmentCategory(entry.category)) {
      throw new Error(`Unsupported equipment category: ${entry.category}`);
    }

    if (entry.status !== "active" && entry.status !== "archived") {
      throw new Error(`Unsupported equipment status: ${entry.status}`);
    }

    return { ...entry, category: entry.category, status: entry.status };
  }
);

const catalogById = new Map(catalogEntries.map((entry) => [entry.id, entry]));

export const getCatalogMetadata = (id: string): EquipmentCatalogMetadata => {
  const entry = catalogById.get(id);
  if (!entry) throw new Error(`Missing public catalog contract for ${id}.`);
  return entry;
};

export const publicRentalCatalog = catalogEntries;

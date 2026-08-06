export type EquipmentCategory =
  | "Heavy Equipment"
  | "Trailers"
  | "Tools"
  | "Motorcycles";

export interface EquipmentRate {
  label: string;
  price: number;
}

export type EquipmentCatalogStatus = "active" | "archived";

export interface EquipmentCatalogMetadata {
  id: string;
  name: string;
  category: EquipmentCategory;
  status: EquipmentCatalogStatus;
  catalogOrder: number;
  dailyRate: number;
  featured: boolean;
  mostPopular: boolean;
}

export interface EquipmentItem extends EquipmentCatalogMetadata {
  startingPrice: number;
  image: string;
  description: string;
  specs: string[];
  rates: EquipmentRate[];
  addOns?: string[];
}

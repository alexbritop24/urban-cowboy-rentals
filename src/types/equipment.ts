export type EquipmentCategory =
  | "Heavy Equipment"
  | "Trailers"
  | "Tools"
  | "Motorcycles";

export type EquipmentCatalogStatus = "active" | "archived";

export interface EquipmentRate {
  label: string;
  price: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  status: EquipmentCatalogStatus;
  catalogOrder: number;
  startingPrice: number;
  image: string;
  description: string;
  specs: string[];
  rates: EquipmentRate[];
  addOns?: string[];
  serialNumber?: string;
  featured?: boolean;
  mostPopular?: boolean;
}

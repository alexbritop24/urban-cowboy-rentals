export type EquipmentCategory =
  | "Heavy Equipment"
  | "Trailers"
  | "Tools"
  | "Motorcycles";

export interface EquipmentRate {
  label: string;
  price: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  startingPrice: number;
  image: string;
  description: string;
  specs: string[];
  rates: EquipmentRate[];
  addOns?: string[];
  featured?: boolean;
}
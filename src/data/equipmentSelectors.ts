import { equipmentData } from "./equipmentData";
import type { EquipmentItem } from "../types/equipment";

export const getBookableEquipment = (): EquipmentItem[] =>
  equipmentData.filter((item) => item.status !== "archived");

export const getEquipmentDailyRate = (item: EquipmentItem): number =>
  item.rates.find((rate) => rate.label.trim().toLowerCase() === "1 day")
    ?.price ?? item.startingPrice;
